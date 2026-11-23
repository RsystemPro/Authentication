import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../config/auth.config.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthTokenPurpose } from '../generated/prisma/client.js';
import { AUTH_MAILER } from './auth-mail.service.js';
import type { AuthMail, AuthMailer } from './auth-mail.service.js';
import type { AuthTransaction, DeviceMetadata } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

export const recoveryResponse = {
  message: 'If this address is eligible, instructions will be sent.',
};

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly deliveries = new Set<Promise<void>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    @Inject(AUTH_MAILER) private readonly mailer: AuthMailer,
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
  ) { }

  private dispatch(message: AuthMail): void {
    // SMTP latency must not reveal account existence. Secrets are held only in
    // memory; delivery failures are recoverable via resend, never logged verbatim.
    const delivery = this.mailer
      .send(message)
      .catch(() => this.logger.error('Authentication email delivery failed'))
      .finally(() => this.deliveries.delete(delivery));
    this.deliveries.add(delivery);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.deliveries);
  }

  private async issueOneTime(
    tx: AuthTransaction,
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<string> {
    //invalidate old tokens, if any, for this user and purpose.
    const now = new Date();
    await tx.authOneTimeToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    //generate new token and store hash in database
    const token = this.tokens.randomToken();
    const seconds =
      purpose === 'EMAIL_VERIFICATION'
        ? this.config.verificationSeconds
        : this.config.resetSeconds;
    await tx.authOneTimeToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.tokens.hashToken(token),
        expiresAt: new Date(now.getTime() + seconds * 1000),
      },
    });
    return token;
  }

  async register(email: string, password: string) {
    await this.passwords.assertAcceptable(password);
    // Hash before attempting insertion, including duplicates, to reduce timing differences.
    const passwordHash = await this.passwords.hash(password);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        //create user
        const user = await tx.user.create({ data: { email, passwordHash } });
        //once time token
        const token = await this.issueOneTime(
          tx,
          user.id,
          'EMAIL_VERIFICATION',
        );
        return { email: user.email, token };
      });
      this.dispatch({ to: result.email, kind: 'verify', token: result.token });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ))
        throw error;
    }
    return recoveryResponse;
  }

  async login(email: string, password: string, metadata: DeviceMetadata) {
    const candidate = await this.prisma.user.findUnique({ where: { email } });
    const matches = await this.passwords.verify(
      candidate?.passwordHash,
      password,
    );

    //check items
    if (
      !candidate ||
      !matches ||
      candidate.status !== 'ACTIVE' ||
      !candidate.emailVerifiedAt
    ) {
      await this.prisma.authSecurityEvent.create({
        data: { type: 'LOGIN_FAILED', userId: candidate?.id },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    //create session
    const result = await this.prisma.$transaction(async (tx) => {
      await this.sessions.lockUser(tx, candidate.id);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      //check for race conditions
      if (
        user.passwordHash !== candidate.passwordHash ||
        user.status !== 'ACTIVE' ||
        !user.emailVerifiedAt
      )
        throw new UnauthorizedException('Invalid email or password');
      const result = await this.sessions.create(tx, user, metadata);
      await this.sessions.event(
        tx,
        'LOGIN_SUCCESS',
        user.id,
        result.session.id,
      );
      return result;
    });
    return this.sessions.credentials(result);
  }

  async requestEmail(email: string, purpose: AuthTokenPurpose) {
    const candidate = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (candidate) {
      const result = await this.prisma.$transaction(async (tx) => {
        await this.sessions.lockUser(tx, candidate.id);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        await this.sessions.event(tx, 'RECOVERY_REQUEST', user.id);
        const eligible = user.status === 'ACTIVE' && (purpose === 'EMAIL_VERIFICATION' ? !user.emailVerifiedAt : Boolean(user.emailVerifiedAt));
        if (!eligible) return null;
        return {
          email: user.email,
          token: await this.issueOneTime(tx, user.id, purpose),
        };
      });
      if (result)
        this.dispatch({
          to: result.email,
          kind: purpose === 'EMAIL_VERIFICATION' ? 'verify' : 'reset',
          token: result.token,
        });
    }
    return recoveryResponse;
  }

  private async consumeOneTime(
    raw: string,
    purpose: AuthTokenPurpose,
    passwordHash?: string,
  ) {
    //check token already exists
    const tokenHash = this.tokens.hashToken(raw);
    const reference = await this.prisma.authOneTimeToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!reference) throw new BadRequestException('Invalid or expired token');
    const result = await this.prisma.$transaction(async (tx) => {
      //lock row
      await this.sessions.lockUser(tx, reference.userId);
      //find user
      const user = await tx.user.findUniqueOrThrow({
        where: { id: reference.userId },
      });
      if (user.status !== 'ACTIVE') return null;
      const now = new Date();
      //consume once time token
      const claimed = await tx.authOneTimeToken.updateMany({
        where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return null;
      if (purpose === 'EMAIL_VERIFICATION') {
        //email verification
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now },
        });
        await this.sessions.event(tx, 'EMAIL_VERIFIED', user.id);
      } else {
        //password reset
        if (!passwordHash) throw new Error('Password hash required for reset');
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
        await tx.authOneTimeToken.updateMany({
          where: {
            userId: user.id,
            purpose: 'PASSWORD_RESET',
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
        //revoke
        await this.sessions.revokeInTransaction(tx, user.id, 'password-reset');
        await this.sessions.event(tx, 'PASSWORD_RESET', user.id);
      }
      return { email: user.email };
    });
    if (!result) throw new BadRequestException('Invalid or expired token');
    return result;
  }

  async verifyEmail(token: string): Promise<void> {
    await this.consumeOneTime(token, 'EMAIL_VERIFICATION');
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.passwords.assertAcceptable(password);
    const hash = await this.passwords.hash(password);
    const user = await this.consumeOneTime(token, 'PASSWORD_RESET', hash);
    this.dispatch({ to: user.email, kind: 'password-changed' });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const candidate = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!(await this.passwords.verify(candidate.passwordHash, currentPassword)))
      throw new UnauthorizedException('Current password is incorrect');

    await this.passwords.assertAcceptable(newPassword);
    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.sessions.lockUser(tx, userId);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (
        current.passwordHash !== candidate.passwordHash ||
        current.status !== 'ACTIVE'
      )
        throw new UnauthorizedException('Reauthentication required');
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.authOneTimeToken.updateMany({
        where: { userId, purpose: 'PASSWORD_RESET', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.sessions.revokeInTransaction(tx, userId, 'password-change');
      await this.sessions.event(tx, 'PASSWORD_CHANGED', userId);
    });
    this.dispatch({ to: candidate.email, kind: 'password-changed' });
  }
}

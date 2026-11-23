import {
  Inject,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../config/auth.config.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  AuthEventType,
  AuthSession,
  User,
} from '../generated/prisma/client.js';
import { TokenService } from './token.service.js';
import {
  publicUser,
  publicUserSelect,
  sanitizeMetadata,
} from './auth.types.js';
import type {
  AuthPrincipal,
  AuthTransaction,
  DeviceMetadata,
} from './auth.types.js';

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleanupRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) { }

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.cleanup().catch(() =>
        this.logger.error('Authentication retention cleanup failed'),
      );
    }, 3_600_000);
    this.cleanupTimer.unref();
  }
  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  // All credential mutations lock User first. This orders refresh, login, reset,
  // password changes and logout across processes, without Redis session caching.
  async lockUser(tx: AuthTransaction, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  }

  async event(
    tx: AuthTransaction,
    type: AuthEventType,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    await tx.authSecurityEvent.create({ data: { type, userId, sessionId } });
  }

  async create(tx: AuthTransaction, user: User, metadata: DeviceMetadata) {
    const now = new Date();
    const absoluteExpiresAt = new Date(
      now.getTime() + this.config.absoluteSessionSeconds * 1000,
    );
    const idleExpiresAt = new Date(
      Math.min(
        now.getTime() + this.config.refreshIdleSeconds * 1000,
        absoluteExpiresAt.getTime(),
      ),
    );
    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        idleExpiresAt,
        absoluteExpiresAt,
        lastUsedAt: now,
        userAgent: sanitizeMetadata(metadata.userAgent, 256),
        ipAddress: sanitizeMetadata(metadata.ipAddress, 64),
      },
    });
    const refreshToken = this.tokens.randomToken();
    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        expiresAt: idleExpiresAt,
      },
    });
    await this.event(tx, 'SESSION_CREATED', user.id, session.id);
    return { user: publicUser(user), session, refreshToken };
  }

  private usable(
    session: AuthSession,
    user: Pick<User, 'status' | 'emailVerifiedAt'>,
    now: Date,
  ): boolean {
    return (
      user.status === 'ACTIVE' &&
      user.emailVerifiedAt !== null &&
      !session.revokedAt &&
      session.idleExpiresAt > now &&
      session.absoluteExpiresAt > now
    );
  }

  async validate(userId: string, sessionId: string): Promise<AuthPrincipal> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { email: true, status: true, emailVerifiedAt: true } },
      },
    });
    if (
      !session ||
      session.userId !== userId ||
      !this.usable(session, session.user, new Date())
    )
      throw new UnauthorizedException('Session is no longer active');
    return { userId, sessionId, email: session.user.email };
  }

  async credentials(result: {
    user: ReturnType<typeof publicUser>;
    session: AuthSession;
    refreshToken: string;
  }) {
    return {
      ...result,
      accessToken: await this.tokens.signAccess(
        result.user.id,
        result.session.id,
      ),
      expiresIn: this.config.accessTtlSeconds,
    };
  }

  async revokeInTransaction(
    tx: AuthTransaction,
    userId: string,
    reason: string,
    sessionId?: string,
  ): Promise<void> {
    const now = new Date();
    const where = { userId, ...(sessionId ? { id: sessionId } : {}) };
    const revoked = await tx.authSession.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: now, revocationReason: reason },
    });
    await tx.refreshToken.updateMany({
      where: { session: where, consumedAt: null },
      data: { expiresAt: now },
    });
    if (revoked.count)
      await this.event(tx, 'SESSION_REVOKED', userId, sessionId);
  }

  // Rotate refresh token and return new credentials
  async rotate(rawToken: string) {
    if (!this.tokens.isOpaqueToken(rawToken))
      throw new UnauthorizedException('Invalid refresh credentials');

    //find refresh token
    const tokenHash = this.tokens.hashToken(rawToken);
    const reference = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { session: { select: { userId: true } } },
    });
    if (!reference)
      throw new UnauthorizedException('Invalid refresh credentials');

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, reference.session.userId);
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          session: {
            include: {
              user: { select: { ...publicUserSelect, status: true } },
            },
          },
        },
      });
      if (!token) return null;
      const { session } = token;
      const now = new Date();

      //revoke session and refresh token if refresh token consumed already
      //possible token theft or reuse attack
      if (token.consumedAt) {
        if (!session.revokedAt) {
          await this.revokeInTransaction(
            tx,
            session.userId,
            'refresh-token-reuse',
            session.id,
          );
          await this.event(tx, 'REFRESH_REUSE', session.userId, session.id);

        }
        return null;
      }

      //check session still usable
      if (!this.usable(session, session.user, now) || token.expiresAt <= now)
        return null;

      //consume refresh token
      const claimed = await tx.refreshToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return null;

      //create refresh token
      const refreshToken = this.tokens.randomToken();
      const idleExpiresAt = new Date(
        Math.min(
          now.getTime() + this.config.refreshIdleSeconds * 1000,
          session.absoluteExpiresAt.getTime(),
        ),
      );
      await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: this.tokens.hashToken(refreshToken),
          expiresAt: idleExpiresAt,
        },
      });

      //update session
      const updated = await tx.authSession.update({
        where: { id: session.id },
        data: { idleExpiresAt, lastUsedAt: now },
      });

      return { user: publicUser(session.user), session: updated, refreshToken };
    });
    if (!result) throw new UnauthorizedException('Invalid refresh credentials');
    return this.credentials(result);
  }

  async revoke(
    userId: string,
    sessionId?: string,
    reason = 'logout',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      if (
        sessionId &&
        !(await tx.authSession.findFirst({
          where: { id: sessionId, userId },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Session not found');
      await this.revokeInTransaction(tx, userId, reason, sessionId);
    });
  }

  async logout(rawToken: unknown): Promise<void> {
    if (!this.tokens.isOpaqueToken(rawToken)) return;
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
      select: { sessionId: true, session: { select: { userId: true } } },
    });
    if (token) await this.revoke(token.session.userId, token.sessionId);
  }

  async list(userId: string, query: { limit: number; cursor?: string }) {
    if (
      query.cursor &&
      !(await this.prisma.authSession.findFirst({
        where: { id: query.cursor, userId },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException('Invalid session cursor');
    }
    const now = new Date();
    const rows = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    return {
      items,
      nextCursor: rows.length > query.limit ? items.at(-1)!.id : null,
    };
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUserSelect,
    });
  }

  async cleanup(): Promise<void> {
    if (this.cleanupRunning) return;
    this.cleanupRunning = true;
    try {
      const before = new Date(
        Date.now() - this.config.retentionDays * 86_400_000,
      );
      const sessionIds = await this.prisma.authSession.findMany({
        where: {
          OR: [
            { revokedAt: { lt: before } },
            { idleExpiresAt: { lt: before } },
            { absoluteExpiresAt: { lt: before } },
          ],
        },
        select: { id: true },
        take: 500,
      });
      await this.prisma.authSession.deleteMany({
        where: { id: { in: sessionIds.map((row) => row.id) } },
      });
      const tokenIds = await this.prisma.authOneTimeToken.findMany({
        where: { expiresAt: { lt: before } },
        select: { id: true },
        take: 500,
      });
      await this.prisma.authOneTimeToken.deleteMany({
        where: { id: { in: tokenIds.map((row) => row.id) } },
      });
      const eventIds = await this.prisma.authSecurityEvent.findMany({
        where: {
          createdAt: {
            lt: new Date(
              Date.now() - this.config.auditRetentionDays * 86_400_000,
            ),
          },
        },
        select: { id: true },
        take: 500,
      });
      await this.prisma.authSecurityEvent.deleteMany({
        where: { id: { in: eventIds.map((row) => row.id) } },
      });
    } finally {
      this.cleanupRunning = false;
    }
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { authConfig } from '../config/auth.config.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import {
  AuthRatePolicy,
  Principal,
  Public,
} from './decorators/auth.decorators.js';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  SessionsQueryDto,
} from './dto/auth.dto.js';
import { AuthCsrfGuard } from './guards/auth-csrf.guard.js';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';
import type { AuthPrincipal } from './auth.types.js';

@Controller('auth')
@UseGuards(AuthCsrfGuard, AuthRateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) { }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookie,
      sameSite: this.config.sameSite,
      path: '/',
    };
  }
  private clearCookie(response: Response): void {
    response.clearCookie(this.config.cookieName, this.cookieOptions());
  }
  private readCookie(request: Request): unknown {
    return (request.cookies as Record<string, unknown> | undefined)?.[
      this.config.cookieName
    ];
  }
  private sendCredentials(
    result: Awaited<ReturnType<SessionService['rotate']>>,
    response: Response,
  ) {
    response.cookie(this.config.cookieName, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.session.idleExpiresAt,
    });
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @AuthRatePolicy('register')
  @Post('register')
  @HttpCode(202)
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.password);
  }

  @Public()
  @AuthRatePolicy('token')
  @Post('verify-email')
  @HttpCode(204)
  verifyEmail(@Body() body: TokenDto) {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @AuthRatePolicy('email')
  @Post('resend-verification')
  @HttpCode(202)
  resendVerification(@Body() body: EmailDto) {
    return this.auth.requestEmail(body.email, 'EMAIL_VERIFICATION');
  }

  @Public()
  @AuthRatePolicy('login')
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const loginData = await this.auth.login(body.email, body.password, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
    return this.sendCredentials(loginData, response);
  }

  @Public()
  @AuthRatePolicy('refresh')
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const raw = this.readCookie(request);
      if (typeof raw !== 'string')
        throw new UnauthorizedException('Invalid refresh credentials');
      return this.sendCredentials(await this.sessions.rotate(raw), response);
    } catch (error) {
      if (error instanceof UnauthorizedException) this.clearCookie(response);
      throw error;
    }
  }

  @Public()
  @AuthRatePolicy('refresh')
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.logout(this.readCookie(request));
    this.clearCookie(response);
  }

  @AuthRatePolicy('token')
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @Principal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revoke(principal.userId);
    this.clearCookie(response);
  }

  @Get('me') me(@Principal() principal: AuthPrincipal) {
    return this.sessions.me(principal.userId);
  }
  @Get('sessions') listSessions(
    @Principal() principal: AuthPrincipal,
    @Query() query: SessionsQueryDto,
  ) {
    return this.sessions.list(principal.userId, query);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @Principal() principal: AuthPrincipal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revoke(principal.userId, id, 'user-revoked');
    if (id === principal.sessionId) this.clearCookie(response);
  }

  @AuthRatePolicy('login')
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @Principal() principal: AuthPrincipal,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(
      principal.userId,
      body.currentPassword,
      body.newPassword,
    );
    this.clearCookie(response);
  }

  @Public()
  @AuthRatePolicy('email')
  @Post('forgot-password')
  @HttpCode(202)
  forgotPassword(@Body() body: EmailDto) {
    return this.auth.requestEmail(body.email, 'PASSWORD_RESET');
  }

  @Public()
  @AuthRatePolicy('token')
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.resetPassword(body.token, body.newPassword);
    this.clearCookie(response);
  }
}

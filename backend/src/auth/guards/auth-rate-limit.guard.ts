import { createHmac } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { authConfig } from '../../config/auth.config.js';
import { RedisThrottlerStorage } from '../../common/redis/redis-throttler.storage.js';
import { RATE_POLICY } from '../decorators/auth.decorators.js';
import type { RatePolicy } from '../decorators/auth.decorators.js';
import type { AuthRequest } from '../auth.types.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly storage: RedisThrottlerStorage,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RatePolicy>(
      RATE_POLICY,
      context.getHandler(),
    );
    if (!policy) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const c = this.config;
    const settings = {
      login: [c.loginIpLimit, c.loginAccountLimit, c.rateWindowMs],
      register: [c.registerIpLimit, c.emailAccountLimit, c.emailWindowMs],
      email: [c.emailIpLimit, c.emailAccountLimit, c.emailWindowMs],
      refresh: [c.refreshIpLimit, c.refreshTokenLimit, c.refreshWindowMs],
      token: [c.tokenAttemptLimit, c.tokenAttemptLimit, c.rateWindowMs],
    }[policy];
    const [ipLimit, accountLimit, windowMs] = settings;
    const body = request.body as Record<string, unknown> | undefined;
    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase().slice(0, 254)
        : undefined;
    const token =
      typeof body?.token === 'string' ? body.token.slice(0, 128) : undefined;
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const cookie =
      typeof cookies?.[c.cookieName] === 'string'
        ? (cookies[c.cookieName] as string)
        : undefined;
    const identity =
      email || request.principal?.userId || token || cookie?.slice(0, 128);
    const entries: Array<[string, number]> = [
      [
        `ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`,
        ipLimit,
      ],
    ];
    if (identity) entries.push([`account:${identity}`, accountLimit]);
    for (const [identityKey, limit] of entries) {
      const digest = createHmac('sha256', c.jwtSecret)
        .update(identityKey)
        .digest('hex');
      // Shared email bucket covers register/resend/forgot, preventing inbox floods
      // that would otherwise bypass a separate per-endpoint counter.
      const bucket =
        policy === 'register' || policy === 'email' ? 'email' : policy;
      const result = await this.storage.increment(
        `${bucket}:${digest}`,
        windowMs,
        limit,
        windowMs,
        'auth',
      );
      if (result.isBlocked) {
        response.setHeader('Retry-After', result.timeToBlockExpire);
        throw new HttpException('Too many requests; try again later', 429);
      }
    }
    return true;
  }
}

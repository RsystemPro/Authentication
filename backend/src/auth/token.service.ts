import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { authConfig } from '../config/auth.config.js';

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.string(),
  aud: z.string(),
});

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  randomToken(): string {
    return randomBytes(32).toString('base64url');
  }
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  isOpaqueToken(token: unknown): token is string {
    return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  signAccess(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sid: sessionId },
      {
        secret: this.config.jwtSecret,
        algorithm: 'HS256',
        subject: userId,
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.accessTtlSeconds,
      },
    );
  }

  async verifyAccess(token: string) {
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.jwtSecret,
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: 0,
      });
      const claims = claimsSchema.parse(payload);
      const now = Math.floor(Date.now() / 1000);
      if (
        claims.iat > now + 30 ||
        claims.exp <= claims.iat ||
        claims.exp - claims.iat > this.config.accessTtlSeconds
      )
        throw new Error('Invalid lifetime');
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

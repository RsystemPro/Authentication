import { randomBytes, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { authConfig } from '../config/auth.config.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  const jwt = new JwtService();
  const config = {
    ...authConfig(),
    jwtSecret: randomBytes(32).toString('base64url'),
  };
  let service: TokenService;
  beforeEach(() => {
    service = new TokenService(jwt, config);
  });

  it('creates random opaque tokens and deterministic SHA-256 hashes', () => {
    const token = service.randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(service.randomToken()).not.toBe(token);
    expect(service.hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(service.hashToken(token)).toBe(service.hashToken(token));
    expect(service.isOpaqueToken('invalid')).toBe(false);
  });

  it('signs and validates the required access claims', async () => {
    const sub = randomUUID(),
      sid = randomUUID();
    const token = await service.signAccess(sub, sid);
    const claims = await service.verifyAccess(token);
    expect(claims).toMatchObject({
      sub,
      sid,
      iss: config.issuer,
      aud: config.audience,
    });
    expect(claims.exp - claims.iat).toBe(600);
  });

  it.each([
    'expired',
    'issuer',
    'audience',
    'algorithm',
    'claims',
    'future-iat',
    'lifetime',
    'signature',
  ])('rejects %s tokens', async (kind) => {
    const now = Math.floor(Date.now() / 1000);
    const payload: {
      sub: string;
      sid: string;
      iss: string;
      aud: string;
      iat: number;
      exp: number;
    } = {
      sub: randomUUID(),
      sid: randomUUID(),
      iss: config.issuer,
      aud: config.audience,
      iat: now,
      exp: now + 600,
    };
    if (kind === 'expired') {
      payload.iat = now - 700;
      payload.exp = now - 100;
    }
    if (kind === 'issuer') payload.iss = 'https://untrusted.example';
    if (kind === 'audience') payload.aud = 'wrong';
    if (kind === 'claims') payload.sid = 'not-a-uuid';
    if (kind === 'future-iat') payload.iat = now + 300;
    if (kind === 'lifetime') payload.exp = now + 3600;
    const token = await jwt.signAsync(payload, {
      secret:
        kind === 'signature'
          ? randomBytes(32).toString('base64url')
          : config.jwtSecret,
      algorithm: kind === 'algorithm' ? 'HS384' : 'HS256',
    });
    await expect(service.verifyAccess(token)).rejects.toThrow(
      'Invalid or expired access token',
    );
  });
});

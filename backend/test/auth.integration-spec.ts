import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from '../src/common/redis/redis-throttler.storage.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createAuthTestApps, passphrase } from './auth-test-app.js';
import type { AuthTestContext } from './auth-test-app.js';

describe('Authentication with real PostgreSQL and Redis', () => {
  let c: AuthTestContext;
  beforeAll(async () => {
    c = await createAuthTestApps();
  }, 60000);
  afterAll(async () => {
    if (c) await c.close();
  });

  it('registers, stores only a password hash and token hashes, and requires verification', async () => {
    const user = await c.register();
    const row = await c.prisma.user.findUniqueOrThrow({
      where: { email: user.email },
      include: { oneTimeTokens: true },
    });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordHash).not.toBe(passphrase);
    expect(row.oneTimeTokens[0].tokenHash).toBe(c.tokens.hashToken(user.token));
    await c
      .post('/auth/login')
      .send({ email: user.email, password: passphrase })
      .expect(401);
    const duplicate = await c
      .post('/auth/register')
      .send({ email: user.email, password: passphrase })
      .expect(202);
    expect(duplicate.body).toEqual({
      message: 'If this address is eligible, instructions will be sent.',
    });
    expect(await c.prisma.user.count({ where: { email: user.email } })).toBe(1);
  });

  it('consumes email verification atomically and only by POST', async () => {
    const user = await c.register();
    await c.client().get(`/auth/verify-email?token=${user.token}`).expect(404);
    const results = await Promise.all([
      c.post('/auth/verify-email').send({ token: user.token }),
      c.post('/auth/verify-email', c.second).send({ token: user.token }),
    ]);
    expect(
      results.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([204, 400]);
    await c.login(user.email);
  });

  it('returns generic login failures for missing, incorrect and disabled accounts', async () => {
    const user = await c.verified();
    const unknown = await c
      .post('/auth/login')
      .send({ email: c.email(), password: passphrase })
      .expect(401);
    const incorrect = await c
      .post('/auth/login')
      .send({ email: user.email, password: 'incorrect' })
      .expect(401);
    await c.prisma.user.update({
      where: { email: user.email },
      data: { status: 'DISABLED' },
    });
    const disabled = await c
      .post('/auth/login')
      .send({ email: user.email, password: passphrase })
      .expect(401);
    expect(unknown.body.message).toBe(incorrect.body.message);
    expect(disabled.body.message).toBe(incorrect.body.message);
  });

  it('rotates refresh credentials, detects replay, and invalidates already-issued JWTs', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const rotated = await c
      .post('/auth/refresh')
      .set('Cookie', login.cookie)
      .expect(200);
    const nextCookie = c.cookie(rotated.headers);
    expect(nextCookie).not.toBe(login.cookie);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(200);
    await c
      .post('/auth/refresh', c.second)
      .set('Cookie', login.cookie)
      .expect(401);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(401);
    await c.post('/auth/refresh').set('Cookie', nextCookie).expect(401);
    expect(
      await c.prisma.authSecurityEvent.count({
        where: { type: 'REFRESH_REUSE', userId: login.body.user.id },
      }),
    ).toBe(1);
  });

  it('allows only one winner across two instances and revokes the raced session', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const results = await Promise.all([
      c.post('/auth/refresh').set('Cookie', login.cookie),
      c.post('/auth/refresh', c.second).set('Cookie', login.cookie),
    ]);
    expect(
      results.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 401]);
    const winner = results.find((response) => response.status === 200)!;
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${winner.body.accessToken}`)
      .expect(401);
    const count = await c.prisma.refreshToken.count({
      where: {
        session: { userId: login.body.user.id },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    expect(count).toBe(0);
  });

  it('rolls back consumption if inserting the replacement token fails', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const raw = login.cookie.split('=')[1];
    const tokenHash = c.tokens.hashToken(raw);
    const spy = vi.spyOn(c.tokens, 'randomToken').mockReturnValueOnce(raw);
    try {
      await expect(c.sessions.rotate(raw)).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(
      (await c.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash } }))
        .consumedAt,
    ).toBeNull();
    await c.post('/auth/refresh').set('Cookie', login.cookie).expect(200);
  });

  it.each(['refresh', 'idle', 'absolute'] as const)(
    'rejects %s expiration',
    async (kind) => {
      const user = await c.verified();
      const login = await c.login(user.email);
      const claims = await c.tokens.verifyAccess(login.body.accessToken);
      const expired = new Date(Date.now() - 1000);
      if (kind === 'refresh')
        await c.prisma.refreshToken.updateMany({
          where: { sessionId: claims.sid },
          data: { expiresAt: expired },
        });
      else
        await c.prisma.authSession.update({
          where: { id: claims.sid },
          data:
            kind === 'idle'
              ? { idleExpiresAt: expired }
              : { absoluteExpiresAt: expired },
        });
      await c.post('/auth/refresh').set('Cookie', login.cookie).expect(401);
    },
  );

  it('keeps independent devices, enforces session ownership, and supports logout all', async () => {
    const user = await c.verified();
    const first = await c.login(user.email);
    const second = await c.login(user.email);
    const other = await c.verified();
    const outsider = await c.login(other.email);
    const sessions = await c
      .client()
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(200);
    expect(sessions.body.items).toHaveLength(2);
    const page = await c
      .client()
      .get('/auth/sessions?limit=1')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    const next = await c
      .client()
      .get(`/auth/sessions?limit=1&cursor=${page.body.nextCursor}`)
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(200);
    expect(next.body.items).toHaveLength(1);
    expect(next.body.items[0].id).not.toBe(page.body.items[0].id);
    expect(next.body.nextCursor).toBeNull();
    const firstClaims = await c.tokens.verifyAccess(first.body.accessToken);
    await c
      .client()
      .delete(`/auth/sessions/${firstClaims.sid}`)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Protection', '1')
      .set('Authorization', `Bearer ${outsider.body.accessToken}`)
      .expect(404);
    await c.post('/auth/logout').set('Cookie', first.cookie).expect(204);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
    await c
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(204);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(401);
  });

  it('revokes a selected device and rejects disabled users with valid JWTs', async () => {
    const user = await c.verified();
    const first = await c.login(user.email);
    const second = await c.login(user.email);
    const claims = await c.tokens.verifyAccess(second.body.accessToken);
    await c
      .client()
      .delete(`/auth/sessions/${claims.sid}`)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Protection', '1')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(204);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(401);
    await c.prisma.user.update({
      where: { email: user.email },
      data: { status: 'DISABLED' },
    });
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
  });

  it('rejects wrong-purpose and expired recovery tokens', async () => {
    const user = await c.register();
    await c
      .post('/auth/reset-password')
      .send({
        token: user.token,
        newPassword: 'A completely different new passphrase!',
      })
      .expect(400);
    await c.prisma.authOneTimeToken.updateMany({
      where: { tokenHash: c.tokens.hashToken(user.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await c.post('/auth/verify-email').send({ token: user.token }).expect(400);
    const generic = await c
      .post('/auth/forgot-password')
      .send({ email: c.email() })
      .expect(202);
    expect(generic.body.message).toContain('If this address');
  });

  it('consumes resets once across instances and revokes all sessions and reset credentials', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    await c
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    const token = c.tokenFromMail(user.email, 'reset');
    const newPassword = 'My fresh and distinctive passphrase!';
    const results = await Promise.all([
      c.post('/auth/reset-password').send({ token, newPassword }),
      c.post('/auth/reset-password', c.second).send({ token, newPassword }),
    ]);
    expect(
      results.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([204, 400]);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await c.post('/auth/refresh').set('Cookie', login.cookie).expect(401);
    await c.login(user.email, c.app, newPassword);
    expect(
      c.messages.some(
        (message) =>
          message.to === user.email && message.kind === 'password-changed',
      ),
    ).toBe(true);
  });

  it('requires the current password and revokes all devices after password change', async () => {
    const user = await c.verified();
    const first = await c.login(user.email);
    const second = await c.login(user.email);
    const body = {
      currentPassword: 'incorrect',
      newPassword: 'My next distinctive long passphrase!',
    };
    await c
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send(body)
      .expect(401);
    await c
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send({ ...body, currentPassword: passphrase })
      .expect(204);
    for (const session of [first, second])
      await c
        .client()
        .get('/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(401);
    await c.login(user.email, c.app, body.newPassword);
  });

  it('retains sessions when another Nest instance restarts', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const restarted = await c.restart(c.second);
    c.second = restarted;
    await c
      .client(restarted)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    await c
      .post('/auth/refresh', restarted)
      .set('Cookie', login.cookie)
      .expect(200);
  });

  it('shares atomic Redis counters and fails closed when Redis fails', async () => {
    const first = c.app.get(RedisThrottlerStorage),
      second = c.second.get(RedisThrottlerStorage);
    const key = randomUUID();
    const results = await Promise.all([
      first.increment(key, 10000, 1, 10000, 'test'),
      second.increment(key, 10000, 1, 10000, 'test'),
    ]);
    expect(results.filter((result) => result.isBlocked)).toHaveLength(1);
    const spy = vi
      .spyOn(c.app.get(RedisService), 'eval')
      .mockRejectedValue(new Error('Redis offline'));
    try {
      await c
        .post('/auth/login')
        .send({ email: c.email(), password: passphrase })
        .expect(503);
    } finally {
      spy.mockRestore();
    }
  });

  it('bounds sliding idle expiry by the absolute session deadline', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const claims = await c.tokens.verifyAccess(login.body.accessToken);
    const absolute = new Date(Date.now() + 120000);
    await c.prisma.authSession.update({
      where: { id: claims.sid },
      data: { absoluteExpiresAt: absolute },
    });
    await c.post('/auth/refresh').set('Cookie', login.cookie).expect(200);
    const session = await c.prisma.authSession.findUniqueOrThrow({
      where: { id: claims.sid },
    });
    expect(session.idleExpiresAt.getTime()).toBe(absolute.getTime());
  });

  it('expires password-reset credentials and prevents using them for verification', async () => {
    const user = await c.verified();
    await c
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    const token = c.tokenFromMail(user.email, 'reset');
    await c.post('/auth/verify-email').send({ token }).expect(400);
    await c.prisma.authOneTimeToken.updateMany({
      where: { tokenHash: c.tokens.hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await c
      .post('/auth/reset-password')
      .send({ token, newPassword: 'Another unique long reset passphrase!' })
      .expect(400);
  });

  it('cleans retained expired records while preserving active sessions and replay history', async () => {
    const user = await c.verified();
    const first = await c.login(user.email);
    const second = await c.login(user.email);
    const firstClaims = await c.tokens.verifyAccess(first.body.accessToken);
    const secondClaims = await c.tokens.verifyAccess(second.body.accessToken);
    const old = new Date(Date.now() - 31 * 86400000);
    await c.prisma.authSession.update({
      where: { id: firstClaims.sid },
      data: { revokedAt: old, idleExpiresAt: old, absoluteExpiresAt: old },
    });
    const spent = await c.prisma.refreshToken.create({
      data: {
        sessionId: secondClaims.sid,
        tokenHash: c.tokens.hashToken(c.tokens.randomToken()),
        expiresAt: old,
        consumedAt: old,
      },
    });
    const expired = await c.prisma.authOneTimeToken.create({
      data: {
        userId: first.body.user.id,
        purpose: 'PASSWORD_RESET',
        tokenHash: c.tokens.hashToken(c.tokens.randomToken()),
        expiresAt: old,
      },
    });
    const event = await c.prisma.authSecurityEvent.create({
      data: {
        userId: first.body.user.id,
        type: 'RECOVERY_REQUEST',
        createdAt: new Date(Date.now() - 91 * 86400000),
      },
    });
    await c.sessions.cleanup();
    expect(
      await c.prisma.authSession.findUnique({ where: { id: firstClaims.sid } }),
    ).toBeNull();
    expect(
      await c.prisma.authOneTimeToken.findUnique({ where: { id: expired.id } }),
    ).toBeNull();
    expect(
      await c.prisma.authSecurityEvent.findUnique({ where: { id: event.id } }),
    ).toBeNull();
    expect(
      await c.prisma.refreshToken.findUnique({ where: { id: spent.id } }),
    ).not.toBeNull();
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
  });

  it('enforces account-based login limits across instances', async () => {
    const email = c.email();
    for (let index = 0; index < 10; index++)
      await c
        .post('/auth/login', index % 2 ? c.app : c.second)
        .set('X-Forwarded-For', `198.51.100.${index}`)
        .send({ email, password: passphrase })
        .expect(401);
    const blocked = await c
      .post('/auth/login', c.second)
      .send({ email, password: passphrase })
      .expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});

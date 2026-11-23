import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuthTestApps, origin, passphrase } from './auth-test-app.js';
import type { AuthTestContext } from './auth-test-app.js';

describe('Authentication HTTP and browser security', () => {
  let c: AuthTestContext;
  beforeAll(async () => {
    c = await createAuthTestApps();
  }, 60000);
  afterAll(async () => {
    if (c) await c.close();
  });

  it('validates request fields and preserves safe grouped validation messages', async () => {
    for (const body of [
      {},
      { email: 'bad', password: passphrase },
      { email: c.email(), password: 'short' },
      { email: c.email(), password: passphrase, status: 'ACTIVE' },
    ]) {
      const response = await c.post('/auth/register').send(body).expect(400);
      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBeTypeOf('object');
      expect(JSON.stringify(response.body)).not.toContain(passphrase);
    }
  });

  it.each([
    'missing-origin',
    'untrusted-origin',
    'missing-header',
    'navigation',
    'cross-site',
  ] as const)('rejects CSRF: %s', async (kind) => {
    const call = c.client().post('/auth/login');
    if (kind !== 'missing-origin')
      call.set(
        'Origin',
        kind === 'untrusted-origin' ? 'https://attacker.example' : origin,
      );
    if (kind !== 'missing-header') call.set('X-CSRF-Protection', '1');
    if (kind === 'navigation') call.set('Sec-Fetch-Mode', 'navigate');
    if (kind === 'cross-site') call.set('Sec-Fetch-Site', 'cross-site');
    await call.send({ email: c.email(), password: passphrase }).expect(403);
  });

  it('uses restricted credentialed CORS and never reflects an untrusted origin', async () => {
    const allowed = await c
      .client()
      .options('/auth/refresh')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'X-CSRF-Protection')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await c
      .client()
      .options('/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns only access credentials, sends HttpOnly cookies and no-store headers', async () => {
    const user = await c.verified();
    const result = await c.login(user.email);
    expect(Object.keys(result.body).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'user',
    ]);
    expect(result.body.user).not.toHaveProperty('passwordHash');
    const headers = result.headers['set-cookie'] as unknown as string[];
    expect(headers[0]).toContain('HttpOnly');
    expect(headers[0]).toContain('Path=/');
    expect(headers[0]).toContain('SameSite=Lax');
    expect(headers[0]).not.toContain('Domain=');
    expect(headers[0]).not.toContain('; Secure');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    const rejected = await c.client().get('/auth/me').expect(401);
    expect(rejected.headers['cache-control']).toBe('no-store');
    expect(rejected.headers['x-request-id']).toBeDefined();
  });

  it('uses host-only Secure cookies when secure deployment settings are enabled', async () => {
    vi.stubEnv('AUTH_COOKIE_SECURE', 'true');
    let secure;
    try {
      secure = await c.create();
    } finally {
      vi.stubEnv('AUTH_COOKIE_SECURE', 'false');
    }
    const user = await c.verified();
    const result = await c.login(user.email, secure);
    const header = String(result.headers['set-cookie']);
    expect(header).toContain('__Host-refresh=');
    expect(header).toContain('; Secure');
    expect(header).toContain('Path=/');
    expect(header).not.toContain('Domain=');
  });

  it('does not trust forwarded client IPs without an explicit proxy configuration', async () => {
    const user = await c.verified();
    const response = await c
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.77')
      .send({ email: user.email, password: passphrase })
      .expect(200);
    const sessions = await c
      .client()
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(sessions.body.items[0].ipAddress).not.toBe('198.51.100.77');
  });

  it('limits recovery email requests across register/resend/forgot routes', async () => {
    const user = await c.register();
    await c
      .post('/auth/resend-verification')
      .send({ email: user.email })
      .expect(202);
    await c
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    await c
      .post('/auth/resend-verification', c.second)
      .send({ email: user.email })
      .expect(429);
  });

  it('clears invalid refresh cookies and rejects tampered access tokens', async () => {
    const user = await c.verified();
    const login = await c.login(user.email);
    const parts = login.body.accessToken.split('.');
    parts[2] = 'A'.repeat(parts[2].length);
    await c
      .client()
      .get('/auth/me')
      .set('Authorization', `Bearer ${parts.join('.')}`)
      .expect(401);
    const failed = await c
      .post('/auth/refresh')
      .set('Cookie', 'refresh_dev=invalid')
      .expect(401);
    expect(String(failed.headers['set-cookie'])).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect(failed.body.message).not.toContain('invalid');
  });
});

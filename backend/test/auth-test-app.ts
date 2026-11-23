import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { AUTH_MAILER } from '../src/auth/auth-mail.service.js';
import type { AuthMail } from '../src/auth/auth-mail.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { setupApp } from '../src/setup-app.js';

export interface Credentials {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email: string };
}
export const passphrase = 'A distinctive interview-ready passphrase!';
export const origin = 'http://localhost:5173';

export async function createAuthTestApps() {
  const databaseUrl = process.env.AUTH_TEST_DATABASE_URL_SB;
  if (!databaseUrl)
    throw new Error(
      'Set AUTH_TEST_DATABASE_URL_SB to the migrated dedicated test database',
    );
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/viraboard_auth_test(?:_[a-z0-9_]+)?$/.test(target.pathname)
  ) {
    throw new Error(
      'Auth integration tests require a dedicated local viraboard_auth_test database',
    );
  }
  const run = randomUUID().slice(0, 8);
  const prefix = `auth-test-${run}-`;
  const redisPrefix = `viraboard:auth-test:${run}:`;
  const environment: Record<string, string> = {
    DATABASE_URL_SB: databaseUrl,
    NODE_ENV: 'test',
    AUTH_JWT_SECRET: randomBytes(32).toString('base64url'),
    AUTH_JWT_ISSUER: 'http://localhost:3000',
    AUTH_JWT_AUDIENCE: 'viraboard-web',
    AUTH_FRONTEND_URL: origin,
    CORS_ORIGINS: origin,
    NETWORK_ACCESS: 'false',
    AUTH_PWNED_PASSWORDS_ENABLED: 'false',
    AUTH_COOKIE_SECURE: 'false',
    AUTH_COOKIE_SAME_SITE: 'lax',
    THROTTLE_LIMIT: '10000',
    AUTH_LOGIN_IP_LIMIT: '1000',
    AUTH_LOGIN_ACCOUNT_LIMIT: '10',
    AUTH_REGISTER_IP_LIMIT: '100',
    AUTH_EMAIL_IP_LIMIT: '100',
    AUTH_EMAIL_ACCOUNT_LIMIT: '3',
    AUTH_TOKEN_ATTEMPT_LIMIT: '100',
    AUTH_REFRESH_IP_LIMIT: '1000',
    AUTH_REFRESH_TOKEN_LIMIT: '100',
    REDIS_KEY_PREFIX: redisPrefix,
    LOG_LEVELS: 'fatal',
    LOG_TYPES: 'console',
  };
  for (const [key, value] of Object.entries(environment))
    vi.stubEnv(key, value);
  const messages: AuthMail[] = [];
  const mailer = {
    send: async (message: AuthMail) => {
      messages.push(message);
    },
  };
  const { AppModule } = await import('../src/app.module.js');
  const apps: INestApplication[] = [];
  const create = async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_MAILER)
      .useValue(mailer)
      .compile();
    const app = moduleRef.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
    apps.push(app);
    return app;
  };
  const app = await create();
  const second = await create();
  const prisma = app.get(PrismaService);
  let nextEmail = 0;
  const email = () => `${prefix}${nextEmail++}@example.test`;
  const client = (instance: INestApplication = app) =>
    request(instance.getHttpServer() as Server);
  const post = (path: string, instance: INestApplication = app) =>
    client(instance)
      .post(path)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1');
  const cookie = (headers: Record<string, unknown>): string => {
    const values = headers['set-cookie'];
    const serialized = Array.isArray(values)
      ? String(values[0])
      : String(values);
    return serialized.split(';')[0];
  };
  const tokenFromMail = (address: string, kind: AuthMail['kind']) => {
    const message = messages
      .filter((entry) => entry.to === address && entry.kind === kind)
      .at(-1);
    if (!message?.token)
      throw new Error(
        'Expected an authentication email in the in-memory test transport',
      );
    return message.token;
  };
  const register = async (address = email()) => {
    await post('/auth/register')
      .send({ email: address, password: passphrase })
      .expect(202);
    return { email: address, token: tokenFromMail(address, 'verify') };
  };
  const verified = async () => {
    const user = await register();
    await post('/auth/verify-email').send({ token: user.token }).expect(204);
    return user;
  };
  const login = async (
    address: string,
    instance: INestApplication = app,
    password = passphrase,
  ) => {
    const response = await post('/auth/login', instance)
      .send({ email: address, password })
      .expect(200);
    return {
      body: response.body as Credentials,
      cookie: cookie(response.headers),
      headers: response.headers,
    };
  };
  const close = async () => {
    // Remove only this run's rows and Redis keys. Other applications and test runs are untouched.
    await prisma.authSecurityEvent.deleteMany({
      where: { user: { email: { startsWith: prefix } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    const redis = app.get(RedisService);
    await redis.eval(
      "local keys = redis.call('KEYS', ARGV[1]); for _,key in ipairs(keys) do redis.call('DEL',key) end; return #keys",
      { keys: [], arguments: [`${redisPrefix}*`] },
    );
    await Promise.all(apps.map((instance) => instance.close()));
    vi.unstubAllEnvs();
  };
  const restart = async (instance: INestApplication) => {
    apps.splice(apps.indexOf(instance), 1);
    await instance.close();
    return create();
  };
  return {
    app,
    second,
    create,
    restart,
    prisma,
    email,
    client,
    post,
    cookie,
    register,
    verified,
    login,
    tokenFromMail,
    messages,
    close,
    sessions: app.get(SessionService),
    tokens: app.get(TokenService),
  };
}

export type AuthTestContext = Awaited<ReturnType<typeof createAuthTestApps>>;

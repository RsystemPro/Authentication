import { randomBytes } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisIoAdapterFactory } from '../common/socket/redis-io-adapter.factory.js';
import { SocketAdapterModule } from '../common/socket/socket-adapter.module.js';
import { appConfig } from './app.config.js';
import { envValidation } from './env.validation.js';
import { redisConfig } from './redis.config.js';

const databaseUrl = 'postgresql://test:password@localhost:5432/viraboard_test';
const validEnv = {
  DATABASE_URL_SB: databaseUrl,
  AUTH_JWT_SECRET: randomBytes(32).toString('base64url'),
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('envValidation', () => {
  it('sets defaults that the process.env-based config factories can consume', () => {
    expect(envValidation.parse(validEnv)).toMatchObject({
      NODE_ENV: 'development',
      PORT: '3000',
      NETWORK_ACCESS: 'false',
      CORS_ORIGINS: 'http://localhost:5173',
      THROTTLE_TTL_MS: '60000',
      THROTTLE_LIMIT: '100',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6379',
      REDIS_DATABASE: '0',
      REDIS_CONNECT_TIMEOUT_MS: '5000',
      REDIS_RECONNECT_MAX_RETRIES: '5',
    });
  });

  it('requires a PostgreSQL URL instead of using a placeholder default', () => {
    expect(envValidation.safeParse({}).success).toBe(false);
  });

  it.each([
    ['NODE_ENV', 'invalid'],
    ['PORT', ''],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3000.5'],
    ['PORT', '3e3'],
    ['PORT', '0xBB8'],
    ['NETWORK_ACCESS', 'yes'],
    ['NETWORK_ACCESS', 'TRUE'],
    ['THROTTLE_TTL_MS', '0'],
    ['THROTTLE_TTL_MS', '2147483648'],
    ['THROTTLE_LIMIT', '-1'],
    ['THROTTLE_LIMIT', 'Infinity'],
    ['THROTTLE_LIMIT', '9007199254740992'],
    ['REDIS_PORT', '65536'],
    ['REDIS_DATABASE', '-1'],
    ['REDIS_DATABASE', '1.5'],
    ['REDIS_CONNECT_TIMEOUT_MS', '0'],
    ['REDIS_RECONNECT_MAX_RETRIES', '-1'],
    ['REDIS_HOST', ''],
    ['REDIS_HOST', 'http://localhost'],
    ['REDIS_HOST', 'localhost:6379'],
    ['REDIS_KEY_PREFIX', '  '],
    ['SOCKET_IO_REDIS_KEY', ''],
    ['LOG_LEVELS', 'error,typo'],
    ['LOG_LEVELS', ''],
    ['LOG_TYPES', 'requests'],
    ['LOG_TYPES', 'console,,request'],
    ['DATABASE_URL_SB', 'https://localhost/database'],
    ['DATABASE_URL_SB', 'postgresql:///database'],
    ['REDIS_URL', 'https://localhost:6379'],
    ['REDIS_URL', 'redis://'],
    ['REDIS_URL', 'redis://localhost/not-a-database'],
    ['REDIS_URL', 'redis://localhost/-1'],
    ['REDIS_URL', 'redis://localhost/1.5'],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'http://localhost:5173/'],
    ['CORS_ORIGINS', 'http://localhost:5173/path'],
    ['CORS_ORIGINS', 'http://user:secret@localhost'],
    ['CORS_ORIGINS', 'http://localhost?query=1'],
    ['CORS_ORIGINS', 'http://localhost#fragment'],
    ['CORS_ORIGINS', 'http://localhost,'],
  ])('rejects invalid %s (%s)', (key, value) => {
    const result = envValidation.safeParse({ ...validEnv, [key]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === key)).toBe(
        true,
      );
    }
  });

  it('accepts production settings, zero database/retries, and all log options', () => {
    expect(
      envValidation.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        AUTH_SMTP_URL: 'smtps://mail.example.com',
        AUTH_MAIL_FROM: 'ViraBoard <no-reply@example.com>',
        AUTH_JWT_ISSUER: 'https://api.example.com',
        AUTH_FRONTEND_URL: 'https://example.com',
        PORT: '65535',
        NETWORK_ACCESS: 'false',
        LOG_LEVELS: 'log,error,warn, debug,verbose,fatal',
        LOG_TYPES: 'request,console',
        REDIS_DATABASE: '0',
        REDIS_HOST: '::1',
        REDIS_RECONNECT_MAX_RETRIES: '0',
        REDIS_URL: 'rediss://user:password@redis.example.com:6379/0',
        CORS_ORIGINS: 'https://example.com',
      }).success,
    ).toBe(true);
  });

  it('allows empty optional Redis credentials and URL for host-based connections', () => {
    expect(
      envValidation.safeParse({
        ...validEnv,
        REDIS_URL: '',
        REDIS_USERNAME: '',
        REDIS_PASSWORD: '',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['AUTH_JWT_SECRET', 'x'.repeat(43)],
    ['AUTH_ACCESS_TTL_SECONDS', '901'],
    ['AUTH_ARGON_MEMORY_KIB', '1024'],
    ['AUTH_ARGON_TIME_COST', '1'],
    ['TRUSTED_PROXY_CIDRS', 'true'],
    ['TRUSTED_PROXY_CIDRS', '1'],
    ['TRUSTED_PROXY_CIDRS', '127.0.0.1/33'],
    ['AUTH_COOKIE_SAME_SITE', 'none'],
    ['AUTH_REFRESH_IDLE_SECONDS', '2592001'],
  ])('rejects unsafe authentication configuration: %s', (key, value) => {
    expect(envValidation.safeParse({ ...validEnv, [key]: value }).success).toBe(
      false,
    );
  });

  it('refuses incomplete production configuration', () => {
    const result = envValidation.safeParse({
      ...validEnv,
      NODE_ENV: 'production',
      AUTH_COOKIE_SECURE: 'false',
      AUTH_PWNED_PASSWORDS_ENABLED: 'false',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining([
          'AUTH_COOKIE_SECURE',
          'AUTH_SMTP_URL',
          'AUTH_MAIL_FROM',
          'AUTH_PWNED_PASSWORDS_ENABLED',
          'AUTH_FRONTEND_URL',
          'AUTH_JWT_ISSUER',
          'CORS_ORIGINS',
        ]),
      );
    }
  });

  it('accepts explicit proxy CIDRs and secure cross-site cookie settings', () => {
    expect(
      envValidation.safeParse({
        ...validEnv,
        TRUSTED_PROXY_CIDRS: '127.0.0.1/32,::1/128',
        AUTH_COOKIE_SAME_SITE: 'none',
        AUTH_COOKIE_SECURE: 'true',
      }).success,
    ).toBe(true);
  });
});

describe('Nest configuration integration', () => {
  const isolateEnvironment = () => {
    for (const key of Object.keys(envValidation.shape)) {
      vi.stubEnv(key, undefined);
    }
    vi.stubEnv('DATABASE_URL_SB', databaseUrl);
    vi.stubEnv('AUTH_JWT_SECRET', validEnv.AUTH_JWT_SECRET);
    vi.stubEnv('NODE_ENV', 'test');
  };

  it('rejects invalid settings at startup without exposing connection secrets', async () => {
    isolateEnvironment();
    vi.stubEnv('DATABASE_URL_SB', 'https://user:do-not-log@localhost/database');
    vi.stubEnv('PORT', 'invalid');

    const error = await ConfigModule.forRoot({
      ignoreEnvFile: true,
      validationSchema: envValidation,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('DATABASE_URL_SB');
    expect(message).toContain('PORT');
    expect(message).not.toContain('do-not-log');
  });

  it('passes validated defaults to factories and preserves unrelated variables', async () => {
    isolateEnvironment();
    vi.stubEnv('LOG_TYPES', 'request, console');
    vi.stubEnv('UNRELATED_ENV', 'preserved');

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validationSchema: envValidation,
          load: [appConfig, redisConfig],
        }),
      ],
    }).compile();

    try {
      const app = moduleRef.get<ConfigType<typeof appConfig>>(appConfig.KEY);
      const redis = moduleRef.get<ConfigType<typeof redisConfig>>(
        redisConfig.KEY,
      );
      expect(app.port).toBe(3000);
      expect(app.networkAccess).toBe(false);
      expect(app.logType).toEqual(['request', 'console']);
      expect(redis.port).toBe(6379);
      expect(redis.database).toBe(0);
      expect(moduleRef.get(ConfigService).get('UNRELATED_ENV')).toBe(
        'preserved',
      );
    } finally {
      await moduleRef.close();
    }
  });

  it('parses console logging and keeps production log-level defaults', () => {
    isolateEnvironment();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_TYPES', 'console');

    expect(appConfig().logType).toEqual(['console']);
    expect(appConfig().logLevels).toEqual(['log', 'error', 'warn', 'fatal']);
  });

  it('resolves the configuration required by the Socket.IO factory', async () => {
    isolateEnvironment();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validationSchema: envValidation,
          load: [appConfig, redisConfig],
        }),
        SocketAdapterModule,
      ],
    }).compile();

    try {
      expect(moduleRef.get(appConfig.KEY)).toBeDefined();
      expect(moduleRef.get(RedisIoAdapterFactory)).toBeDefined();
    } finally {
      await moduleRef.close();
    }
  });
});

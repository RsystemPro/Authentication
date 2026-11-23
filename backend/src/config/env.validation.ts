import { z } from 'zod';
import { isIP } from 'node:net';

const integer = (minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .regex(/^\d+$/, 'Must contain only decimal digits')
    .refine((value) => {
      const number = Number(value);
      return (
        Number.isSafeInteger(number) && number >= minimum && number <= maximum
      );
    }, `Must be an integer between ${minimum} and ${maximum}`);

const connectionUrl = (
  protocols: string[],
  message: string,
  check: (url: URL) => boolean = () => true,
) =>
  z.string().refine((value) => {
    try {
      const url = new URL(value);
      return (
        value === value.trim() &&
        protocols.includes(url.protocol) &&
        url.hostname.length > 0 &&
        check(url)
      );
    } catch {
      return false;
    }
  }, message);

const csv = (item: z.ZodType<string>, message: string) =>
  z.string().refine((value) => {
    const items = value.split(',').map((entry) => entry.trim());
    return items.every((entry) => item.safeParse(entry).success);
  }, message);

const logTypes = csv(
  z.enum(['request', 'console']),
  'Use a non-empty comma-separated list containing request and/or console',
);
const corsOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.username === '' &&
      url.password === '' &&
      value === url.origin
    );
  } catch {
    return false;
  }
}, 'Must be an HTTP(S) origin without credentials, paths, or a trailing slash');

const redisUrl = connectionUrl(
  ['redis:', 'rediss:'],
  'Must be a redis:// or rediss:// URL with a host and optional non-negative database index',
  (url) => {
    const database = url.pathname.slice(1);
    return (
      database === '' ||
      (/^\d+$/.test(database) && Number.isSafeInteger(Number(database)))
    );
  },
);

// Keep numeric/boolean values as strings: the config factories read process.env.
// Nest preserves environment variables not declared in this schema.
export const envValidation = z
  .object({
    AUTH_JWT_SECRET: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{43,}$/,
        'Use at least 32 random bytes encoded as base64url',
      )
      .refine(
        (value) =>
          Buffer.from(value, 'base64url').length >= 32 &&
          new Set(value).size >= 16,
        'Use a cryptographically random signing secret',
      ),
    AUTH_JWT_ISSUER: connectionUrl(
      ['http:', 'https:'],
      'Must be an HTTP(S) issuer URL',
    ).default('http://localhost:3000'),
    AUTH_JWT_AUDIENCE: z.string().min(1).max(128).default('viraboard-web'),
    AUTH_FRONTEND_URL: corsOrigin.default('http://localhost:5173'),
    AUTH_ACCESS_TTL_SECONDS: integer(60, 900).default('600'),
    AUTH_REFRESH_IDLE_SECONDS: integer(600, 2_592_000).default('1209600'),
    AUTH_SESSION_TTL_SECONDS: integer(600, 7_776_000).default('2592000'),
    AUTH_VERIFICATION_TTL_SECONDS: integer(60, 86_400).default('86400'),
    AUTH_RESET_TTL_SECONDS: integer(60, 1800).default('900'),
    AUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    AUTH_ARGON_MEMORY_KIB: integer(19_456, 262_144).default('19456'),
    AUTH_ARGON_TIME_COST: integer(2, 10).default('2'),
    AUTH_PWNED_PASSWORDS_ENABLED: z.enum(['true', 'false']).default('true'),
    AUTH_SMTP_URL: connectionUrl(
      ['smtp:', 'smtps:'],
      'Must be an SMTP(S) URL',
    ).optional(),
    AUTH_MAIL_FROM: z
      .string()
      .min(3)
      .max(254)
      .regex(/^[^\r\n]+$/)
      .refine(
        (value) =>
          z.email().safeParse(value.match(/<([^<>]+)>$/)?.[1] ?? value).success,
        'Must contain a valid sender email address',
      )
      .optional(),
    AUTH_RATE_WINDOW_MS: integer(1000, 86_400_000).default('900000'),
    AUTH_EMAIL_RATE_WINDOW_MS: integer(1000, 86_400_000).default('3600000'),
    AUTH_REFRESH_RATE_WINDOW_MS: integer(1000, 86_400_000).default('60000'),
    AUTH_LOGIN_IP_LIMIT: integer(1, 1000).default('20'),
    AUTH_LOGIN_ACCOUNT_LIMIT: integer(1, 100).default('10'),
    AUTH_REGISTER_IP_LIMIT: integer(1, 100).default('5'),
    AUTH_EMAIL_ACCOUNT_LIMIT: integer(1, 20).default('3'),
    AUTH_EMAIL_IP_LIMIT: integer(1, 100).default('10'),
    AUTH_REFRESH_IP_LIMIT: integer(1, 1000).default('60'),
    AUTH_REFRESH_TOKEN_LIMIT: integer(1, 100).default('30'),
    AUTH_TOKEN_ATTEMPT_LIMIT: integer(1, 100).default('10'),
    AUTH_RETENTION_DAYS: integer(1, 90).default('30'),
    AUTH_AUDIT_RETENTION_DAYS: integer(1, 365).default('90'),
    TRUSTED_PROXY_CIDRS: z
      .string()
      .refine(
        (value) =>
          value.split(',').every((entry) => {
            const [ip, bits, ...rest] = entry.trim().split('/');
            const version = isIP(ip);
            return (
              Boolean(version) &&
              rest.length === 0 &&
              (bits === undefined ||
                (/^\d+$/.test(bits) &&
                  Number(bits) <= (version === 4 ? 32 : 128)))
            );
          }),
        'Use explicit proxy IP addresses or CIDRs, never true or a hop count',
      )
      .optional(),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: integer(1, 65_535).default('3000'),
    NETWORK_ACCESS: z.enum(['true', 'false']).default('false'),
    LOG_LEVELS: csv(
      z.enum(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']),
      'Use a non-empty comma-separated list of log,error,warn,debug,verbose,fatal',
    ).optional(),
    LOG_TYPES: logTypes.optional(),
    THROTTLE_TTL_MS: integer(1, 2_147_483_647).default('60000'),
    THROTTLE_LIMIT: integer(1).default('100'),
    CORS_ORIGINS: csv(
      corsOrigin,
      'Use comma-separated HTTP(S) origins without credentials, paths, or trailing slashes',
    ).default('http://localhost:5173'),
    DATABASE_URL_SB: connectionUrl(
      ['postgres:', 'postgresql:'],
      'Must be a PostgreSQL connection URL with a host',
    ),
    REDIS_URL: z.union([z.literal(''), redisUrl]).optional(),
    REDIS_HOST: z
      .union([z.hostname(), z.ipv4(), z.ipv6()])
      .default('127.0.0.1'),
    REDIS_PORT: integer(1, 65_535).default('6379'),
    REDIS_DATABASE: integer(0).default('0'),
    REDIS_USERNAME: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_KEY_PREFIX: z
      .string()
      .refine((value) => value.trim().length > 0, 'Must not be blank')
      .default('mvt:'),
    REDIS_CONNECT_TIMEOUT_MS: integer(1, 2_147_483_647).default('5000'),
    REDIS_RECONNECT_MAX_RETRIES: integer(0).default('5'),
    SOCKET_IO_REDIS_KEY: z
      .string()
      .refine((value) => value.trim().length > 0, 'Must not be blank')
      .default('mvt:socket.io'),
  })
  .superRefine((env, context) => {
    const fail = (key: string, message: string) =>
      context.addIssue({ code: 'custom', path: [key], message });
    if (
      Number(env.AUTH_REFRESH_IDLE_SECONDS) >
      Number(env.AUTH_SESSION_TTL_SECONDS)
    ) {
      fail(
        'AUTH_REFRESH_IDLE_SECONDS',
        'Must not exceed the absolute session lifetime',
      );
    }
    const secure =
      env.AUTH_COOKIE_SECURE === 'true' ||
      (env.NODE_ENV === 'production' && env.AUTH_COOKIE_SECURE !== 'false');
    if (env.AUTH_COOKIE_SAME_SITE === 'none' && !secure)
      fail('AUTH_COOKIE_SAME_SITE', 'SameSite=None requires Secure cookies');
    if (
      !env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .includes(env.AUTH_FRONTEND_URL)
    ) {
      fail('AUTH_FRONTEND_URL', 'Must be included in CORS_ORIGINS');
    }
    if (env.NODE_ENV === 'production') {
      if (!secure)
        fail('AUTH_COOKIE_SECURE', 'Secure cookies are required in production');
      if (env.NETWORK_ACCESS === 'true')
        fail(
          'NETWORK_ACCESS',
          'Credentialed authentication requires an explicit origin allowlist',
        );
      if (!env.AUTH_SMTP_URL)
        fail(
          'AUTH_SMTP_URL',
          'Email delivery must be configured in production',
        );
      if (!env.AUTH_MAIL_FROM)
        fail('AUTH_MAIL_FROM', 'A sender address is required in production');
      if (env.AUTH_PWNED_PASSWORDS_ENABLED !== 'true')
        fail(
          'AUTH_PWNED_PASSWORDS_ENABLED',
          'Compromised-password screening is required in production',
        );
      if (!env.AUTH_FRONTEND_URL.startsWith('https://'))
        fail('AUTH_FRONTEND_URL', 'HTTPS is required in production');
      if (!env.AUTH_JWT_ISSUER.startsWith('https://'))
        fail('AUTH_JWT_ISSUER', 'HTTPS is required in production');
      if (
        env.CORS_ORIGINS.split(',').some(
          (origin) => !origin.trim().startsWith('https://'),
        )
      )
        fail('CORS_ORIGINS', 'HTTPS origins are required in production');
    }
  });

import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => {
  const production = process.env.NODE_ENV === 'production';
  const secureCookie = process.env.AUTH_COOKIE_SECURE === 'true' || (production && process.env.AUTH_COOKIE_SECURE !== 'false');
  return {
    jwtSecret: process.env.AUTH_JWT_SECRET!,
    issuer: process.env.AUTH_JWT_ISSUER ?? 'http://localhost:3000',
    audience: process.env.AUTH_JWT_AUDIENCE ?? 'viraboard-web',
    accessTtlSeconds: Number(process.env.AUTH_ACCESS_TTL_SECONDS ?? 600),
    refreshIdleSeconds: Number(
      process.env.AUTH_REFRESH_IDLE_SECONDS ?? 1_209_600,
    ),
    absoluteSessionSeconds: Number(
      process.env.AUTH_SESSION_TTL_SECONDS ?? 2_592_000,
    ),
    verificationSeconds: Number(
      process.env.AUTH_VERIFICATION_TTL_SECONDS ?? 86_400,
    ),
    resetSeconds: Number(process.env.AUTH_RESET_TTL_SECONDS ?? 900),
    frontendUrl: process.env.AUTH_FRONTEND_URL ?? 'http://localhost:5173',
    secureCookie,
    cookieName: secureCookie ? '__Host-refresh' : 'refresh_dev',
    sameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
    argonMemoryKiB: Number(process.env.AUTH_ARGON_MEMORY_KIB ?? 19_456),
    argonTimeCost: Number(process.env.AUTH_ARGON_TIME_COST ?? 2),
    checkPwnedPasswords: process.env.AUTH_PWNED_PASSWORDS_ENABLED !== 'false',
    smtpUrl: process.env.AUTH_SMTP_URL || undefined,
    mailFrom: process.env.AUTH_MAIL_FROM ?? 'ViraBoard <no-reply@localhost>',
    rateWindowMs: Number(process.env.AUTH_RATE_WINDOW_MS ?? 900_000),
    emailWindowMs: Number(process.env.AUTH_EMAIL_RATE_WINDOW_MS ?? 3_600_000),
    refreshWindowMs: Number(process.env.AUTH_REFRESH_RATE_WINDOW_MS ?? 60_000),
    loginIpLimit: Number(process.env.AUTH_LOGIN_IP_LIMIT ?? 20),
    loginAccountLimit: Number(process.env.AUTH_LOGIN_ACCOUNT_LIMIT ?? 10),
    registerIpLimit: Number(process.env.AUTH_REGISTER_IP_LIMIT ?? 5),
    emailAccountLimit: Number(process.env.AUTH_EMAIL_ACCOUNT_LIMIT ?? 3),
    emailIpLimit: Number(process.env.AUTH_EMAIL_IP_LIMIT ?? 10),
    refreshIpLimit: Number(process.env.AUTH_REFRESH_IP_LIMIT ?? 60),
    refreshTokenLimit: Number(process.env.AUTH_REFRESH_TOKEN_LIMIT ?? 30),
    tokenAttemptLimit: Number(process.env.AUTH_TOKEN_ATTEMPT_LIMIT ?? 10),
    retentionDays: Number(process.env.AUTH_RETENTION_DAYS ?? 30),
    auditRetentionDays: Number(process.env.AUTH_AUDIT_RETENTION_DAYS ?? 90),
  };
});

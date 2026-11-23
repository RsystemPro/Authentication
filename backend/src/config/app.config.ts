import { LogLevel } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

const DEFAULT_LOG_LEVELS: LogLevel[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
];

type LogType = 'request' | 'console';

const isLogType = (value: string): value is LogType =>
  value === 'request' || value === 'console';

const isLogLevel = (value: string): value is LogLevel =>
  DEFAULT_LOG_LEVELS.includes(value as LogLevel) || value === 'fatal';

const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const appConfig = registerAs('app', () => {
  const environment = process.env.NODE_ENV ?? 'development';
  const networkAccess = process.env.NETWORK_ACCESS === 'true';
  const configuredLogLevels = parseCsv(
    process.env.LOG_LEVELS ??
    (environment === 'production'
      ? 'log,error,warn,fatal'
      : 'log,error,warn,debug'),
  ).filter(isLogLevel);
  const logTypes = parseCsv(
    process.env.LOG_TYPES ?? 'console',
  ).filter(isLogType);

  return {
    networkAccess,
    port: Number(process.env.PORT ?? 3000),
    throttleTtlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
    throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 100),
    logLevels:
      configuredLogLevels.length > 0 ? configuredLogLevels : DEFAULT_LOG_LEVELS,
    corsOrigins: parseCsv(process.env.CORS_ORIGINS ?? 'http://localhost:5173'),
    logType: logTypes,
  };
});

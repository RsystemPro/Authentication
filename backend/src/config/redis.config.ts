import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL || undefined,
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  database: Number(process.env.REDIS_DATABASE ?? 0),
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'mvt:',
  connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5_000),
  reconnectMaxRetries: Number(process.env.REDIS_RECONNECT_MAX_RETRIES ?? 5),
  socketIoKey: process.env.SOCKET_IO_REDIS_KEY ?? 'mvt:socket.io',
}));

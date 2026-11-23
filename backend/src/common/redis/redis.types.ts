import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

export type RedisMessageHandler = (
  message: string,
  channel: string,
) => void | Promise<void>;

export type RedisUnsubscribe = () => Promise<void>;

export type RedisCompareAndSwapResult = 'rotated' | 'missing' | 'mismatch';

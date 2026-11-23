import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service.js';

// Redis supplies the clock and executes the entire increment/block operation
// atomically. TTL bounds memory; a blocked request does not extend its own ban.
const INCREMENT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local values = redis.call('HMGET', KEYS[1], 'hits', 'expires', 'blocked')
local hits = tonumber(values[1]) or 0
local expires = tonumber(values[2]) or 0
local blocked = tonumber(values[3]) or 0
if expires <= now then hits = 0; expires = now + tonumber(ARGV[1]) end
if blocked <= now then
  hits = hits + 1
  if hits > tonumber(ARGV[2]) then blocked = now + tonumber(ARGV[3]) end
end
redis.call('HSET', KEYS[1], 'hits', hits, 'expires', expires, 'blocked', blocked)
redis.call('PEXPIRE', KEYS[1], math.max(expires, blocked) - now)
return {hits, math.max(0, expires-now), blocked > now and 1 or 0, math.max(0, blocked-now)}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    name: string,
  ): Promise<Awaited<ReturnType<ThrottlerStorage['increment']>>> {
    const storageKey = this.redis.key(
      `viraboard:throttle:${createHash('sha256').update(`${name}:${key}`).digest('hex')}`,
    );
    try {
      const result = await this.redis.eval(INCREMENT, {
        keys: [storageKey],
        arguments: [String(ttl), String(limit), String(blockDuration || ttl)],
      });
      if (
        !Array.isArray(result) ||
        result.length !== 4 ||
        !result.every((value) => typeof value === 'number')
      )
        throw new Error('Invalid throttle response');
      const [totalHits, expiresMs, blocked, blockMs] = result as number[];
      return {
        totalHits,
        timeToExpire: Math.ceil(expiresMs / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Request protection is temporarily unavailable',
      );
    }
  }
}

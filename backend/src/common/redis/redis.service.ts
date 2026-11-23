import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createClient } from 'redis';
import { redisConfig } from '../../config/redis.config.js';
import { RedisClient, RedisCompareAndSwapResult } from './redis.types.js';

const COMPARE_AND_SWAP_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
if current ~= ARGV[1] then
  redis.call('DEL', KEYS[1])
  return -1
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

const COMPARE_AND_DELETE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current and current == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly commandClient: RedisClient;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly configuration: ConfigType<typeof redisConfig>,
  ) {
    this.commandClient = this.createCommandClient();
    this.attachClientLogging(this.commandClient, 'commands');
  }

  async onModuleInit(): Promise<void> {
    if (!this.commandClient.isOpen) {
      await this.commandClient.connect();
    }
    this.logger.log('Redis command client connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.commandClient.isOpen) {
      await this.commandClient.close();
    }
  }

  key(suffix: string): string {
    const prefix = this.configuration.keyPrefix.endsWith(':')
      ? this.configuration.keyPrefix
      : `${this.configuration.keyPrefix}:`;

    return `${prefix}${suffix.replace(/^:+/, '')}`;
  }

  get(key: string): Promise<string | null> {
    return this.commandClient.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds === undefined) {
      await this.commandClient.set(key, value);
      return;
    }

    this.assertPositiveTtl(ttlSeconds);
    await this.commandClient.set(key, value, { EX: ttlSeconds });
  }

  del(key: string): Promise<number> {
    return this.commandClient.del(key);
  }

  ping(): Promise<string> {
    return this.commandClient.ping();
  }

  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown> {
    if (!this.commandClient.isReady) {
      return Promise.reject(new Error('Redis is not ready'));
    }
    return this.commandClient
      .withAbortSignal(AbortSignal.timeout(2000))
      .eval(script, options);
  }

  duplicateClient(label: string): RedisClient {
    const client = this.commandClient.duplicate();
    this.attachClientLogging(client, label);
    return client;
  }

  async compareAndSwap(
    key: string,
    expected: string,
    next: string,
    ttlSeconds: number,
  ): Promise<RedisCompareAndSwapResult> {
    this.assertPositiveTtl(ttlSeconds);

    const result = await this.commandClient.eval(COMPARE_AND_SWAP_SCRIPT, {
      keys: [key],
      arguments: [expected, next, ttlSeconds.toString()],
    });

    if (result === 1) {
      return 'rotated';
    }
    if (result === 0) {
      return 'missing';
    }
    if (result === -1) {
      return 'mismatch';
    }

    throw new Error('Redis returned an unexpected compare-and-swap result');
  }

  async compareAndDelete(key: string, expected: string): Promise<boolean> {
    const result = await this.commandClient.eval(COMPARE_AND_DELETE_SCRIPT, {
      keys: [key],
      arguments: [expected],
    });

    return result === 1;
  }

  private createCommandClient(): RedisClient {
    const socket = this.configuration.url
      ? {
          connectTimeout: this.configuration.connectTimeoutMs,
          reconnectStrategy: this.reconnectStrategy,
        }
      : {
          host: this.configuration.host,
          port: this.configuration.port,
          connectTimeout: this.configuration.connectTimeoutMs,
          reconnectStrategy: this.reconnectStrategy,
        };

    return createClient({
      ...(this.configuration.url
        ? { url: this.configuration.url }
        : {
            username: this.configuration.username,
            password: this.configuration.password,
            database: this.configuration.database,
          }),
      socket,
    });
  }

  private attachClientLogging(client: RedisClient, label: string): void {
    client.on('error', (error: Error) => {
      this.logger.error(`Redis ${label} client error: ${error.message}`);
    });
    client.on('reconnecting', () => {
      this.logger.warn(`Redis ${label} client is reconnecting`);
    });
  }

  private assertPositiveTtl(ttlSeconds: number): void {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError('Redis TTL must be a positive integer');
    }
  }

  private readonly reconnectStrategy = (retries: number): number | Error => {
    if (retries >= this.configuration.reconnectMaxRetries) {
      return new Error('Redis reconnect retry limit reached');
    }

    return Math.min(100 * 2 ** retries, 3_000);
  };
}

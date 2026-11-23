import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from './redis.service.js';
import {
  RedisClient,
  RedisMessageHandler,
  RedisUnsubscribe,
} from './redis.types.js';

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private readonly publisher: RedisClient;
  private readonly subscriber: RedisClient;
  private readonly handlers = new Map<
    string,
    Map<RedisMessageHandler, (message: string, channel: string) => void>
  >();

  constructor(redisService: RedisService) {
    this.publisher = redisService.duplicateClient('pub/sub publisher');
    this.subscriber = redisService.duplicateClient('pub/sub subscriber');
  }

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([
        this.connectIfNeeded(this.publisher),
        this.connectIfNeeded(this.subscriber),
      ]);
    } catch (error) {
      await this.closeClients();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.handlers.clear();
    await this.closeClients();
  }

  publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  async subscribe(
    channel: string,
    handler: RedisMessageHandler,
  ): Promise<RedisUnsubscribe> {
    const existing = this.handlers.get(channel)?.get(handler);
    if (!existing) {
      const wrapped = (message: string, actualChannel: string): void => {
        void Promise.resolve(handler(message, actualChannel)).catch(
          (error: unknown) => {
            const messageText =
              error instanceof Error ? error.message : 'Unknown handler error';
            this.logger.error(
              `Redis subscriber handler failed for ${actualChannel}: ${messageText}`,
            );
          },
        );
      };

      await this.subscriber.subscribe(channel, wrapped);

      const channelHandlers =
        this.handlers.get(channel) ??
        new Map<
          RedisMessageHandler,
          (message: string, actualChannel: string) => void
        >();
      channelHandlers.set(handler, wrapped);
      this.handlers.set(channel, channelHandlers);
    }

    return () => this.unsubscribe(channel, handler);
  }

  async unsubscribe(
    channel: string,
    handler?: RedisMessageHandler,
  ): Promise<void> {
    const channelHandlers = this.handlers.get(channel);

    if (!handler) {
      if (channelHandlers) {
        await this.subscriber.unsubscribe(channel);
        this.handlers.delete(channel);
      }
      return;
    }

    if (!channelHandlers) {
      return;
    }

    const wrapped = channelHandlers.get(handler);
    if (!wrapped) {
      return;
    }

    await this.subscriber.unsubscribe(channel, wrapped);
    channelHandlers.delete(handler);
    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
    }
  }

  private async connectIfNeeded(client: RedisClient): Promise<void> {
    if (!client.isOpen) {
      await client.connect();
    }
  }

  private async closeClients(): Promise<void> {
    await Promise.allSettled(
      [this.subscriber, this.publisher]
        .filter((client) => client.isOpen)
        .map((client) => client.close()),
    );
  }
}

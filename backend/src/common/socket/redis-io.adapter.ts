import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, ServerOptions } from 'socket.io';
import { RedisService } from '../redis/redis.service.js';
import { RedisClient } from '../redis/redis.types.js';

export class RedisIoAdapter extends IoAdapter {
  private readonly publisher: RedisClient;
  private readonly subscriber: RedisClient;
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private connectPromise?: Promise<void>;
  private disposePromise?: Promise<void>;

  constructor(
    app: INestApplicationContext,
    redisService: RedisService,
    private readonly channelKey: string,
    private readonly corsOrigins: boolean | string[],
  ) {
    super(app);
    this.publisher = redisService.duplicateClient('Socket.IO publisher');
    this.subscriber = redisService.duplicateClient('Socket.IO subscriber');
  }

  connectToRedis(): Promise<void> {
    this.connectPromise ??= this.connectClients();
    return this.connectPromise;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    if (!this.adapterConstructor) {
      throw new Error(
        'Socket.IO Redis adapter must connect before the server is created',
      );
    }

    // Socket.IO accepts partial options; Nest's adapter types require ServerOptions.
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.corsOrigins,
      },
    } as ServerOptions) as Server;

    server.adapter(this.adapterConstructor);
    return server;
  }

  override dispose(): Promise<void> {
    this.disposePromise ??= this.closeClients();
    return this.disposePromise;
  }

  private async connectClients(): Promise<void> {
    try {
      await Promise.all([
        this.connectIfNeeded(this.publisher),
        this.connectIfNeeded(this.subscriber),
      ]);
      this.adapterConstructor = createAdapter(this.publisher, this.subscriber, {
        key: this.channelKey,
        publishOnSpecificResponseChannel: true,
      });
    } catch (error) {
      await this.closeClients();
      throw error;
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

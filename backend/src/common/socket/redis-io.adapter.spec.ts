import { vi, type Mock } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server } from 'socket.io';
import { RedisService } from '../redis/redis.service.js';
import type { RedisClient } from '../redis/redis.types.js';
import { RedisIoAdapter } from './redis-io.adapter.js';

vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(),
}));

const createClientMock = (): {
  client: RedisClient;
  mocks: Record<string, Mock>;
} => {
  const state = { isOpen: false };
  const mocks = {
    connect: vi.fn(() => {
      state.isOpen = true;
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      state.isOpen = false;
      return Promise.resolve();
    }),
  };
  const client = {
    ...mocks,
    get isOpen() {
      return state.isOpen;
    },
  } as unknown as RedisClient;

  return { client, mocks };
};

describe('RedisIoAdapter', () => {
  let publisher: ReturnType<typeof createClientMock>;
  let subscriber: ReturnType<typeof createClientMock>;
  let adapter: RedisIoAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = createClientMock();
    subscriber = createClientMock();
    const redisService = {
      duplicateClient: vi
        .fn()
        .mockReturnValueOnce(publisher.client)
        .mockReturnValueOnce(subscriber.client),
    } as unknown as RedisService;
    adapter = new RedisIoAdapter(
      {} as INestApplicationContext,
      redisService,
      'mvt:test:socket.io',
      ['http://localhost:5173'],
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects dedicated clients and constructs the scaling adapter once', async () => {
    const adapterConstructor = vi.fn();
    vi.mocked(createAdapter).mockReturnValue(adapterConstructor);

    await Promise.all([adapter.connectToRedis(), adapter.connectToRedis()]);

    expect(publisher.mocks.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.mocks.connect).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith(
      publisher.client,
      subscriber.client,
      {
        key: 'mvt:test:socket.io',
        publishOnSpecificResponseChannel: true,
      },
    );
  });

  it('requires Redis initialization before creating a Socket.IO server', () => {
    expect(() => adapter.createIOServer(0)).toThrow(
      'Socket.IO Redis adapter must connect before the server is created',
    );
  });

  it('applies configured CORS and attaches the Redis adapter', async () => {
    const adapterConstructor = vi.fn();
    vi.mocked(createAdapter).mockReturnValue(adapterConstructor);
    await adapter.connectToRedis();
    const serverAdapter = vi.fn();
    const server = { adapter: serverAdapter } as unknown as Server;
    const createServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(server);

    expect(adapter.createIOServer(0)).toBe(server);
    expect(createServerSpy).toHaveBeenCalledWith(0, {
      cors: { origin: ['http://localhost:5173'] },
    });
    expect(serverAdapter).toHaveBeenCalledWith(adapterConstructor);
  });

  it('cleans up its clients once when Nest disposes the adapter', async () => {
    await adapter.connectToRedis();

    await Promise.all([adapter.dispose(), adapter.dispose()]);

    expect(publisher.mocks.close).toHaveBeenCalledTimes(1);
    expect(subscriber.mocks.close).toHaveBeenCalledTimes(1);
  });

  it('closes a partially connected client after initialization fails', async () => {
    subscriber.mocks.connect.mockRejectedValueOnce(new Error('offline'));

    await expect(adapter.connectToRedis()).rejects.toThrow('offline');
    expect(publisher.mocks.close).toHaveBeenCalledTimes(1);
  });
});

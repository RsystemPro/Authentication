import { vi, type Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { RedisPubSubService } from './redis-pub-sub.service.js';
import { RedisService } from './redis.service.js';
import type { RedisClient, RedisMessageHandler } from './redis.types.js';

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
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
  const client = {
    ...mocks,
    get isOpen() {
      return state.isOpen;
    },
  } as unknown as RedisClient;

  return { client, mocks };
};

describe('RedisPubSubService', () => {
  let publisher: ReturnType<typeof createClientMock>;
  let subscriber: ReturnType<typeof createClientMock>;
  let service: RedisPubSubService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    publisher = createClientMock();
    subscriber = createClientMock();
    const redisService = {
      duplicateClient: vi
        .fn()
        .mockReturnValueOnce(publisher.client)
        .mockReturnValueOnce(subscriber.client),
    } as unknown as RedisService;
    service = new RedisPubSubService(redisService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects and closes dedicated publisher and subscriber clients', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(publisher.mocks.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.mocks.connect).toHaveBeenCalledTimes(1);
    expect(publisher.mocks.close).toHaveBeenCalledTimes(1);
    expect(subscriber.mocks.close).toHaveBeenCalledTimes(1);
  });

  it('publishes only through the dedicated publisher', async () => {
    publisher.mocks.publish.mockResolvedValueOnce(2);

    await expect(service.publish('events:test', 'payload')).resolves.toBe(2);
    expect(publisher.mocks.publish).toHaveBeenCalledWith(
      'events:test',
      'payload',
    );
  });

  it('subscribes, dispatches, and removes the exact handler', async () => {
    const handler = vi.fn() as RedisMessageHandler & Mock;
    const unsubscribe = await service.subscribe('events:test', handler);
    const wrapped = getSubscribedHandler(subscriber.mocks.subscribe);

    wrapped('payload', 'events:test');
    await Promise.resolve();
    await unsubscribe();

    expect(handler).toHaveBeenCalledWith('payload', 'events:test');
    expect(subscriber.mocks.unsubscribe).toHaveBeenCalledWith(
      'events:test',
      wrapped,
    );
  });

  it('logs asynchronous subscriber handler failures', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error');
    const handler = vi.fn().mockRejectedValue(new Error('handler failed'));
    await service.subscribe('events:test', handler);
    const wrapped = getSubscribedHandler(subscriber.mocks.subscribe);

    wrapped('payload', 'events:test');
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('handler failed'),
    );
  });
});

const getSubscribedHandler = (
  subscribeMock: Mock,
): ((message: string, channel: string) => void) => {
  const calls = subscribeMock.mock.calls as unknown[][];
  const listener: unknown = calls[0]?.[1];
  if (typeof listener !== 'function') {
    throw new Error('Expected a Redis subscription listener');
  }

  return listener as (message: string, channel: string) => void;
};

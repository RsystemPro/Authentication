import { vi, type Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createClient } from 'redis';
import { redisConfig } from '../../config/redis.config.js';
import { RedisService } from './redis.service.js';
import type { RedisClient } from './redis.types.js';

vi.mock('redis', () => ({
  createClient: vi.fn(),
}));

const createClientMock = (): {
  client: RedisClient;
  mocks: Record<string, Mock>;
} => {
  const state = { isOpen: false };
  const mocks = {
    on: vi.fn(),
    connect: vi.fn(() => {
      state.isOpen = true;
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      state.isOpen = false;
      return Promise.resolve();
    }),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn(),
    duplicate: vi.fn(),
    eval: vi.fn(),
  };
  const client = {
    ...mocks,
    get isOpen() {
      return state.isOpen;
    },
  } as unknown as RedisClient;
  mocks.on.mockReturnValue(client);

  return { client, mocks };
};

describe('RedisService', () => {
  const configuration: ConfigType<typeof redisConfig> = {
    url: undefined,
    host: '127.0.0.1',
    port: 6379,
    username: undefined,
    password: undefined,
    database: 0,
    keyPrefix: 'mvt:',
    connectTimeoutMs: 5_000,
    reconnectMaxRetries: 5,
    socketIoKey: 'mvt:socket.io',
  };

  let command: ReturnType<typeof createClientMock>;
  let service: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    command = createClientMock();
    vi.mocked(createClient).mockReturnValue(command.client);
    service = new RedisService(configuration);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects and closes its command client with the module lifecycle', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(command.mocks.connect).toHaveBeenCalledTimes(1);
    expect(command.mocks.close).toHaveBeenCalledTimes(1);
  });

  it('builds consistently prefixed keys', () => {
    expect(service.key('auth:refresh:123')).toBe('mvt:auth:refresh:123');
    expect(service.key(':auth:refresh:123')).toBe('mvt:auth:refresh:123');
  });

  it('sets values with and without a TTL', async () => {
    await service.set('plain', 'value');
    await service.set('expiring', 'value', 60);

    expect(command.mocks.set).toHaveBeenNthCalledWith(1, 'plain', 'value');
    expect(command.mocks.set).toHaveBeenNthCalledWith(2, 'expiring', 'value', {
      EX: 60,
    });
  });

  it('rejects non-positive or fractional TTL values', async () => {
    await expect(service.set('key', 'value', 0)).rejects.toThrow(RangeError);
    await expect(
      service.compareAndSwap('key', 'old', 'new', 1.5),
    ).rejects.toThrow(RangeError);
  });

  it.each([
    [1, 'rotated'],
    [0, 'missing'],
    [-1, 'mismatch'],
  ] as const)(
    'maps compare-and-swap result %s to %s',
    async (redisResult, expectedResult) => {
      command.mocks.eval.mockResolvedValueOnce(redisResult);

      await expect(
        service.compareAndSwap('refresh-key', 'old-hash', 'new-hash', 120),
      ).resolves.toBe(expectedResult);
      expect(command.mocks.eval).toHaveBeenCalledWith(expect.any(String), {
        keys: ['refresh-key'],
        arguments: ['old-hash', 'new-hash', '120'],
      });
    },
  );

  it('only reports compare-and-delete success when Redis deletes the key', async () => {
    command.mocks.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(service.compareAndDelete('refresh-key', 'hash')).resolves.toBe(
      true,
    );
    await expect(
      service.compareAndDelete('refresh-key', 'stale-hash'),
    ).resolves.toBe(false);
  });

  it('returns an independently owned duplicate client with error listeners', () => {
    const duplicate = createClientMock();
    command.mocks.duplicate.mockReturnValueOnce(duplicate.client);

    expect(service.duplicateClient('test')).toBe(duplicate.client);
    expect(duplicate.mocks.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
  });

  it('uses bounded reconnect backoff from typed configuration', () => {
    const options = vi.mocked(createClient).mock.calls[0][0];
    const strategy = options?.socket?.reconnectStrategy;

    expect(typeof strategy).toBe('function');
    if (typeof strategy !== 'function') {
      throw new Error('Expected a reconnect strategy');
    }

    expect(strategy(0, new Error('offline'))).toBe(100);
    expect(strategy(5, new Error('offline'))).toBeInstanceOf(Error);
  });
});

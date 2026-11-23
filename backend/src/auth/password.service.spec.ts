import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authConfig } from '../config/auth.config.js';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  let service: PasswordService;
  beforeEach(() => {
    service = new PasswordService({
      ...authConfig(),
      checkPwnedPasswords: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses salted Argon2id and handles missing or incorrect credentials', async () => {
    const password = 'A long memorable passphrase!';
    const hash = await service.hash(password);
    expect(hash).toMatch(/^\$argon2id\$v=19\$/);
    expect(hash.split('$')[3].split(',').sort()).toEqual([
      'm=19456',
      'p=1',
      't=2',
    ]);
    expect(await service.hash(password)).not.toBe(hash);
    expect(await service.verify(hash, password)).toBe(true);
    expect(await service.verify(hash, 'wrong')).toBe(false);
    expect(await service.verify(undefined, password)).toBe(false);
  });

  it('rejects common, short, and oversized passwords without querying HIBP', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const password of ['short', 'passwordpassword', 'x'.repeat(129)])
      await expect(service.assertAcceptable(password)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends only a hash prefix, requests padding, and rejects breached passwords', async () => {
    const password = 'A long but breached passphrase!';
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(`${hash.slice(5)}:10\r\n${'F'.repeat(35)}:0`),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(service.assertAcceptable(password)).rejects.toThrow(
      'known breaches',
    );
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
    );
    expect(options.headers['Add-Padding']).toBe('true');
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(password);
  });

  it('ignores padding counts of zero and fails closed when screening is unavailable', async () => {
    const password = 'A very distinctive long passphrase';
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(`${hash.slice(5)}:0`)),
    );
    await expect(service.assertAcceptable(password)).resolves.toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(service.assertAcceptable(password)).rejects.toThrow(
      'temporarily unavailable',
    );
  });
});

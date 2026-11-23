import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { authConfig } from '../config/auth.config.js';

const commonPasswords = new Set([
  'passwordpassword',
  '123456789012345',
  '1234567890123456',
  'qwertyuiopasdfgh',
  'letmeinletmeinletmein',
  'iloveyouiloveyou',
  'password123456789',
]);

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash?: string;
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) { }

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.argonMemoryKiB,
      timeCost: this.config.argonTimeCost,
      parallelism: 1,
    });
  }

  async verify(hash: string | undefined, password: string): Promise<boolean> {
    this.dummyHash ??= await this.hash(randomBytes(32).toString('base64url'));
    const encoded = hash?.startsWith('$argon2id$') ? hash : this.dummyHash;
    try {
      const valid = await argon2.verify(encoded, password);
      return Boolean(hash && valid && encoded === hash);
    } catch {
      return false;
    }
  }

  async assertAcceptable(password: string): Promise<void> {
    if (
      Array.from(password).length < 15 ||
      Array.from(password).length > 128 ||
      Buffer.byteLength(password) > 1024 ||
      commonPasswords.has(password.toLowerCase())
    ) {
      throw new BadRequestException(
        'Choose a longer, uncommon passphrase (15–128 characters)',
      );
    }
    if (!this.config.checkPwnedPasswords) return;
    // SHA-1 is only a lookup identifier for HIBP's k-anonymity API, never password storage.
    const digest = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    let body: string;
    try {
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`,
        {
          headers: {
            'Add-Padding': 'true',
            'User-Agent': 'ViraBoard-Password-Screening',
          },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!response.ok) throw new Error('Screening unavailable');
      body = await response.text();
      if (body.length > 2_000_000 || !/^[A-F0-9]{35}:\d+/m.test(body))
        throw new Error('Invalid screening response');
    } catch {
      throw new ServiceUnavailableException(
        'Password screening is temporarily unavailable',
      );
    }
    if (
      body.split(/\r?\n/).some((line) => {
        const [suffix, count] = line.split(':');
        return suffix === digest.slice(5) && Number(count) > 0;
      })
    ) {
      throw new BadRequestException(
        'This password appears in known breaches; choose another passphrase',
      );
    }
  }
}

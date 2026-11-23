import { Inject, Injectable, INestApplicationContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config.js';
import { redisConfig } from '../../config/redis.config.js';
import { RedisService } from '../redis/redis.service.js';
import { RedisIoAdapter } from './redis-io.adapter.js';

@Injectable()
export class RedisIoAdapterFactory {
  constructor(
    private readonly redisService: RedisService,
    @Inject(redisConfig.KEY)
    private readonly redisConfiguration: ConfigType<typeof redisConfig>,
    @Inject(appConfig.KEY)
    private readonly applicationConfiguration: ConfigType<typeof appConfig>,
  ) { }

  create(app: INestApplicationContext): RedisIoAdapter {
    return new RedisIoAdapter(
      app,
      this.redisService,
      this.redisConfiguration.socketIoKey,
      this.applicationConfiguration.networkAccess
        ? true
        : this.applicationConfiguration.corsOrigins,
    );
  }
}

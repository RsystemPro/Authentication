import { Global, Module } from '@nestjs/common';
import { RedisPubSubService } from './redis-pub-sub.service.js';
import { RedisService } from './redis.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import { redisConfig } from '../../config/redis.config.js';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [RedisService, RedisPubSubService, RedisThrottlerStorage],
  exports: [RedisService, RedisPubSubService, RedisThrottlerStorage, ConfigModule],
})
export class RedisModule { }

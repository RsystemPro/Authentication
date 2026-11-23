import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { RequestLoggingInterceptor } from '../common/interceptors/request-logging.interceptor.js';
import { appConfig } from '../config/index.js';
import { RedisModule } from '../common/redis/redis.module.js';
import { RedisThrottlerStorage } from '../common/redis/redis-throttler.storage.js';

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(appConfig), RedisModule],
      inject: [appConfig.KEY, RedisThrottlerStorage],
      useFactory: (
        config: ConfigType<typeof appConfig>,
        storage: RedisThrottlerStorage,
      ): ThrottlerModuleOptions => ({
        storage,
        skipIf: (context) => context.getType() !== 'http',
        throttlers: [
          {
            ttl: config.throttleTtlMs,
            limit: config.throttleLimit,
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          errorFormat: 'grouped',
        }),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class CoreModule {}

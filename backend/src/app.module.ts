import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { redisConfig } from './config/redis.config.js';
import { envValidation } from './config/env.validation.js';
import { RedisModule } from './common/redis/redis.module.js';
import { CoreModule } from './core/core.module.js';
import { SocketAdapterModule } from './common/socket/socket-adapter.module.js';
import { AuthModule } from './auth/auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig],
      validationSchema: envValidation,
    }),
    CoreModule,
    RedisModule,
    SocketAdapterModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

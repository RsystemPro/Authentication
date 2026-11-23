import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { RedisIoAdapterFactory } from './redis-io-adapter.factory.js';

@Global()
@Module({
  imports: [RedisModule],
  providers: [RedisIoAdapterFactory],
  exports: [RedisIoAdapterFactory],
})
export class SocketAdapterModule { }

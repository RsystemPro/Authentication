import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ConfigType } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { Logger, ConsoleLogger } from '@nestjs/common';
import { RedisIoAdapterFactory } from './common/socket/redis-io-adapter.factory.js';
import { setupApp } from './setup-app.js';
import { setupSwagger } from './common/swagger/setup-swagger.js';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    bufferLogs: true,
    logger: new ConsoleLogger({
      timestamp: true,
    }),
  });
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Logger
  app.useLogger(config.logLevels);

  setupApp(app);
  app.enableShutdownHooks();

  try {
    setupSwagger(app);

    // Redis
    const redisIoAdapter = app.get(RedisIoAdapterFactory).create(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);

    // PORT
    await app.listen(config.port);
  } catch (error) {
    await app.close();
    throw error;
  }
}

// shutdown the application if bootstrap fails, and log the error stack trace if available
void bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);
  bootstrapLogger.error('Application failed to start', details);
  process.exitCode = 1;
});

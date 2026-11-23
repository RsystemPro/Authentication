import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { appConfig } from './config/app.config.js';
import {
  getOrCreateRequestId,
  REQUEST_ID_HEADER,
} from './core/request-context.js';

export function setupApp(app: INestApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const express = app.getHttpAdapter().getInstance() as {
    set(key: string, value: unknown): void;
  };
  const proxies = process.env.TRUSTED_PROXY_CIDRS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  express.set('trust proxy', proxies?.length ? proxies : false);
  app.useSecurityHeaders();
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader(REQUEST_ID_HEADER, getOrCreateRequestId(request));
    if (request.path === '/auth' || request.path.startsWith('/auth/')) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
    }
    next();
  });
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Accept, Authorization, Range, X-Request-Id, X-CSRF-Protection',
    exposedHeaders:
      'Accept-Ranges, Content-Length, Content-Range, ETag, X-Request-Id, Retry-After',
  });
}

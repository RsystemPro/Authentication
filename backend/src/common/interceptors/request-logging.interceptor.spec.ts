import { appConfig } from '../../config/app.config.js';
import { vi } from 'vitest';
import { ExecutionContext, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { REQUEST_ID_HEADER } from '../../core/request-context.js';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';

describe('RequestLoggingInterceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('echoes a request id and logs timing without query parameters', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const request = {
      headers: { [REQUEST_ID_HEADER]: 'request-456' },
      method: 'GET',
      originalUrl: '/things?token=do-not-log',
      path: '/things',
    } as unknown as Request;
    const setHeader = vi.fn();
    const response = {
      setHeader,
      statusCode: 200,
    } as unknown as Response;
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const interceptor = new RequestLoggingInterceptor({
      ...appConfig(),
      logType: ['request'],
    });

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }),
    );

    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'request-456');
    expect(log).toHaveBeenCalledTimes(1);
    const message = String(log.mock.calls[0][0]);
    expect(message).toContain('GET /things 200');
    expect(message).toContain('requestId=request-456');
    expect(message).not.toContain('token');
    expect(message).not.toContain('do-not-log');
  });
});

import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import {
  getOrCreateRequestId,
  REQUEST_ID_HEADER,
  RequestWithId
} from '../../core/request-context.js';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/index.js';

const BAD_REQUEST_STATUS: number = HttpStatus.BAD_REQUEST;
const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) { }

  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    if (!this.config.logType.includes('request')) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = getOrCreateRequestId(request);
    const startedAt = performance.now();
    let exceptionStatus: number | undefined;

    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          exceptionStatus =
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
        },
      }),
      finalize(() => {
        const statusCode = exceptionStatus ?? response.statusCode;
        const durationMs = Math.max(0, performance.now() - startedAt).toFixed(1);
        const message = `${request.method} ${request.path || '/'} ${statusCode} ${durationMs}ms requestId=${requestId}`;

        if (statusCode >= INTERNAL_SERVER_ERROR_STATUS) {
          this.logger.error(message);
        } else if (statusCode >= BAD_REQUEST_STATUS) {
          this.logger.warn(message);
        } else {
          this.logger.log(message);
        }
      }),
    );
  }
}

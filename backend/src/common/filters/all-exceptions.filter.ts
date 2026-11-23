import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  getOrCreateRequestId,
  REQUEST_ID_HEADER,
} from '../../core/request-context.js';
import type { RequestWithId } from '../../core/request-context.js';

type PublicMessage = string | string[] | Record<string, string[]>;

const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

export interface StandardHttpErrorResponse {
  statusCode: number;
  error: string;
  message: PublicMessage;
  timestamp: string;
  path: string;
  requestId: string;
}

interface PublicExceptionDetails {
  error: string;
  message: PublicMessage;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPublicMessage = (value: unknown): value is PublicMessage =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string')) ||
  (isRecord(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((item) => typeof item === 'string'),
    ));

const getStatusLabel = (statusCode: number): string => {
  const statusName = HttpStatus[statusCode];

  if (typeof statusName !== 'string') {
    return 'Error';
  }

  return statusName
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

const getPublicExceptionDetails = (
  exception: HttpException,
  statusCode: number,
): PublicExceptionDetails => {
  const response = exception.getResponse();
  const fallbackError = getStatusLabel(statusCode);

  if (typeof response === 'string') {
    return { error: fallbackError, message: response };
  }

  if (!isRecord(response)) {
    return { error: fallbackError, message: fallbackError };
  }

  return {
    error: typeof response.error === 'string' ? response.error : fallbackError,
    message: isPublicMessage(response.message)
      ? response.message
      : exception.message || fallbackError,
  };
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception instanceof Error
        ? exception
        : new Error('Unhandled non-HTTP exception', { cause: exception });
    }

    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = getOrCreateRequestId(request);
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const path = request.path || '/';

    this.logServerError(exception, request, statusCode, path, requestId);

    if (response.headersSent) {
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    const details =
      exception instanceof HttpException
        ? getPublicExceptionDetails(exception, statusCode)
        : {
            error: 'Internal Server Error',
            message: 'Internal server error',
          };
    const body: StandardHttpErrorResponse = {
      statusCode,
      error: details.error,
      message: details.message,
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(statusCode).json(body);
  }

  private logServerError(
    exception: unknown,
    request: Request,
    statusCode: number,
    path: string,
    requestId: string,
  ): void {
    if (statusCode < INTERNAL_SERVER_ERROR_STATUS) {
      return;
    }

    const message = `${request.method} ${path} ${statusCode} requestId=${requestId}`;

    if (exception instanceof Error && !path.startsWith('/auth')) {
      this.logger.error(message, exception.stack);
      return;
    }

    this.logger.error(message);
  }
}

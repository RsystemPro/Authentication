import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type RequestWithId = Request & {
  requestId?: string;
};

const isValidRequestId = (value: unknown): value is string =>
  typeof value === 'string' && REQUEST_ID_PATTERN.test(value);

export const getOrCreateRequestId = (request: RequestWithId): string => {
  if (isValidRequestId(request.requestId)) {
    return request.requestId;
  }

  const headerValue = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const requestId = isValidRequestId(candidate) ? candidate : randomUUID();

  request.requestId = requestId;
  return requestId;
};

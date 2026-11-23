import { vi, type MockedFunction } from 'vitest';
import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../../core/request-context.js';
import {
  AllExceptionsFilter,
  StandardHttpErrorResponse,
} from './all-exceptions.filter.js';

type JsonResponder = (body: StandardHttpErrorResponse) => Response;
type SetHeader = (name: string, value: string) => Response;
type SetStatus = (statusCode: number) => Response;

interface FilterHarness {
  host: ArgumentsHost;
  request: Request;
  response: Response;
  setHeader: MockedFunction<SetHeader>;
  status: MockedFunction<SetStatus>;
  json: MockedFunction<JsonResponder>;
}

const createHarness = (requestId?: string): FilterHarness => {
  const request = {
    headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : {},
    method: 'GET',
    path: '/things',
  } as unknown as Request;
  const setHeader = vi.fn<SetHeader>();
  const status = vi.fn<SetStatus>();
  const json = vi.fn<JsonResponder>();
  const response = {
    headersSent: false,
    writableEnded: false,
    end: vi.fn(),
    json,
    setHeader,
    status,
  } as unknown as Response;
  setHeader.mockReturnValue(response);
  status.mockReturnValue(response);
  json.mockReturnValue(response);
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, request, response, setHeader, status, json };
};

describe('AllExceptionsFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a safe standardized response for unexpected errors', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const harness = createHarness();
    const filter = new AllExceptionsFilter();

    filter.catch(new Error('sensitive database details'), harness.host);

    expect(harness.status).toHaveBeenCalledWith(500);
    expect(harness.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );
    const body = harness.json.mock.calls[0]?.[0];
    expect(body?.statusCode).toBe(500);
    expect(body?.error).toBe('Internal Server Error');
    expect(body?.message).toBe('Internal server error');
    expect(body?.path).toBe('/things');
    expect(typeof body?.requestId).toBe('string');
    expect(JSON.stringify(body)).not.toContain('sensitive database details');
  });

  it('preserves public validation messages and an accepted request id', () => {
    const harness = createHarness('request-123');
    const filter = new AllExceptionsFilter();

    filter.catch(
      new BadRequestException({
        error: 'Bad Request',
        message: ['email must be an email'],
      }),
      harness.host,
    );

    expect(harness.status).toHaveBeenCalledWith(400);
    const body = harness.json.mock.calls[0]?.[0];
    expect(body?.statusCode).toBe(400);
    expect(body?.error).toBe('Bad Request');
    expect(body?.message).toEqual(['email must be an email']);
    expect(body?.requestId).toBe('request-123');
  });
});

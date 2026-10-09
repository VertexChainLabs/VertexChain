import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildHost(
  method = 'GET',
  url = '/test',
): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const response = { status } as unknown as import('express').Response;
  const request = { method, url } as unknown as import('express').Request;

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    // Silence logger output during tests
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = origNodeEnv;
  });

  // ─── HttpException — string response ──────────────────────────────────────

  it('uses HttpException status and string message', () => {
    const { host, json, status } = buildHost();
    const exc = new HttpException('Not allowed', HttpStatus.FORBIDDEN);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Not allowed' }),
    );
  });

  // ─── HttpException — object response (class-validator style) ──────────────

  it('extracts message array from HttpException object response', () => {
    const { host, json } = buildHost();
    const exc = new HttpException({ message: ['field is required'] }, HttpStatus.BAD_REQUEST);

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: ['field is required'] }),
    );
  });

  // ─── NotFoundException (subclass of HttpException) ────────────────────────

  it('handles NotFoundException with 404 status', () => {
    const { host, json, status } = buildHost();
    const exc = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  // ─── Non-HttpException → 500 ──────────────────────────────────────────────

  it('maps unknown errors to 500 in development and passes the message through', () => {
    process.env.NODE_ENV = 'development';
    const { host, json, status } = buildHost();

    filter.catch(new Error('Unexpected DB failure'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Unexpected DB failure' }),
    );
  });

  it('masks unknown error message with "Internal server error" in production', () => {
    process.env.NODE_ENV = 'production';
    const { host, json, status } = buildHost();

    filter.catch(new Error('Sensitive internal detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
    expect(json.mock.calls[0][0].message).not.toContain('Sensitive internal detail');
  });

  // ─── Response envelope shape ──────────────────────────────────────────────

  it('always includes statusCode, timestamp, path, and message in the envelope', () => {
    const { host, json } = buildHost('POST', '/api/gists');
    filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('statusCode');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('path', '/api/gists');
    expect(body).toHaveProperty('message');
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
  });

  // ─── Logger calls ─────────────────────────────────────────────────────────

  it('calls logger.error for 5xx exceptions', () => {
    const { host } = buildHost();
    filter.catch(new Error('boom'), host);

    expect(loggerErrorSpy).toHaveBeenCalled();
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('calls logger.warn for 4xx exceptions', () => {
    const { host } = buildHost();
    filter.catch(new HttpException('not found', HttpStatus.NOT_FOUND), host);

    expect(loggerWarnSpy).toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('includes stack trace in error log in development', () => {
    process.env.NODE_ENV = 'development';
    const { host } = buildHost();
    const err = new Error('dev error');

    filter.catch(err, host);

    const [, stack] = loggerErrorSpy.mock.calls[0] as [string, string | undefined];
    expect(stack).toContain('Error: dev error');
  });

  it('does not include stack trace in error log in production', () => {
    process.env.NODE_ENV = 'production';
    const { host } = buildHost();

    filter.catch(new Error('prod error'), host);

    const [, stack] = loggerErrorSpy.mock.calls[0] as [string, string | undefined];
    expect(stack ?? '').toBe('');
  });
});

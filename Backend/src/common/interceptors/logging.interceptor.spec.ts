import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildContext(method = 'GET', url = '/gists', statusCode = 200): ExecutionContext {
  const request = { method, url, ip: '127.0.0.1' };
  const response = { statusCode };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(value: unknown = { ok: true }): CallHandler {
  return { handle: jest.fn().mockReturnValue(of(value)) };
}

function buildErrorHandler(error: Error): CallHandler {
  return { handle: jest.fn().mockReturnValue(throwError(() => error)) };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── handle() is called exactly once ──────────────────────────────────────

  it('calls callHandler.handle() exactly once', (done) => {
    const handler = buildHandler();
    const ctx = buildContext();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(handler.handle).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  // ─── /health short-circuit ────────────────────────────────────────────────

  it('does not log anything for /health requests', (done) => {
    const ctx = buildContext('GET', '/health');
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('does not log for paths starting with /health (e.g. /health/liveness)', (done) => {
    const ctx = buildContext('GET', '/health/liveness');
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  // ─── 2xx → logger.log ─────────────────────────────────────────────────────

  it('calls logger.log for 200 responses', (done) => {
    const ctx = buildContext('GET', '/gists', 200);
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('log line includes method, url, status and duration', (done) => {
    const ctx = buildContext('POST', '/gists', 201);
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        const logLine = logSpy.mock.calls[0][0] as string;
        expect(logLine).toContain('POST');
        expect(logLine).toContain('/gists');
        expect(logLine).toContain('201');
        expect(logLine).toMatch(/\d+ms/);
        done();
      },
    });
  });

  // ─── 4xx → logger.warn ────────────────────────────────────────────────────

  it('calls logger.warn for 400 responses', (done) => {
    const ctx = buildContext('POST', '/gists', 400);
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('calls logger.warn for 404 responses', (done) => {
    const ctx = buildContext('GET', '/gists/404', 404);
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(warnSpy).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  // ─── 5xx → logger.error ───────────────────────────────────────────────────

  it('calls logger.error for 500 responses', (done) => {
    const ctx = buildContext('GET', '/gists', 500);
    const handler = buildHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  // ─── handler throws → error tap ───────────────────────────────────────────

  it('calls logger.error via error tap when the handler throws', (done) => {
    const ctx = buildContext('POST', '/gists', 500);
    const handler = buildErrorHandler(new Error('DB exploded'));

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logLine = errorSpy.mock.calls[0][0] as string;
        expect(logLine).toContain('ERROR');
        expect(logLine).toContain('DB exploded');
        done();
      },
    });
  });

  it('error tap log includes method and url', (done) => {
    const ctx = buildContext('DELETE', '/gists/1', 500);
    const handler = buildErrorHandler(new Error('not found'));

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        const logLine = errorSpy.mock.calls[0][0] as string;
        expect(logLine).toContain('DELETE');
        expect(logLine).toContain('/gists/1');
        done();
      },
    });
  });
});

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

interface ContextOptions {
  method?: string;
  url?: string;
  ip?: string;
  statusCode?: number;
}

function mockContext(options: ContextOptions = {}): ExecutionContext {
  const { method = 'GET', url = '/gists', ip = '127.0.0.1', statusCode = 200 } = options;
  const request = { method, url, ip };
  const response = { statusCode };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function mockCallHandler(result: Observable<unknown>): jest.Mocked<CallHandler> {
  return { handle: jest.fn().mockReturnValue(result) } as unknown as jest.Mocked<CallHandler>;
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let loggerLog: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    loggerLog = jest.spyOn((interceptor as any).logger, 'log').mockImplementation(() => undefined);
    loggerWarn = jest
      .spyOn((interceptor as any).logger, 'warn')
      .mockImplementation(() => undefined);
    loggerError = jest
      .spyOn((interceptor as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('invokes callHandler.handle exactly once', async () => {
    const next = mockCallHandler(of({ id: 'gist-1' }));

    const result = await firstValueFrom(interceptor.intercept(mockContext(), next));

    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'gist-1' });
  });

  describe('health check short circuit', () => {
    it('passes the response through without logging for /health', async () => {
      const next = mockCallHandler(of({ status: 'ok' }));

      const result = await firstValueFrom(
        interceptor.intercept(mockContext({ url: '/health' }), next),
      );

      expect(result).toEqual({ status: 'ok' });
      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(loggerLog).not.toHaveBeenCalled();
      expect(loggerWarn).not.toHaveBeenCalled();
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('logs non-health paths as usual', async () => {
      const next = mockCallHandler(of({ id: 1 }));

      await firstValueFrom(interceptor.intercept(mockContext({ url: '/metrics' }), next));

      expect(loggerLog).toHaveBeenCalledTimes(1);
      expect(loggerLog).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/metrics 200 \d+ms — 127\.0\.0\.1$/),
      );
    });
  });

  describe('success path', () => {
    it('logs method, url, status, duration and ip through logger.log', async () => {
      const next = mockCallHandler(of({ id: 'gist-1' }));

      await firstValueFrom(
        interceptor.intercept(mockContext({ method: 'POST', url: '/gists', ip: '10.0.0.1' }), next),
      );

      expect(loggerLog).toHaveBeenCalledTimes(1);
      expect(loggerLog).toHaveBeenCalledWith(
        expect.stringMatching(/^POST \/gists 200 \d+ms — 10\.0\.0\.1$/),
      );
      expect(loggerWarn).not.toHaveBeenCalled();
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('reports the elapsed time from Date.now()', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1042);
      const next = mockCallHandler(of({ id: 'gist-1' }));

      await firstValueFrom(interceptor.intercept(mockContext(), next));

      expect(loggerLog).toHaveBeenCalledWith('GET /gists 200 42ms — 127.0.0.1');
    });

    it('logs 4xx responses through logger.warn', async () => {
      const next = mockCallHandler(of({ statusCode: 404 }));

      await firstValueFrom(interceptor.intercept(mockContext({ statusCode: 404 }), next));

      expect(loggerWarn).toHaveBeenCalledTimes(1);
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/gists 404 \d+ms — 127\.0\.0\.1$/),
      );
      expect(loggerLog).not.toHaveBeenCalled();
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('logs 5xx responses through logger.error', async () => {
      const next = mockCallHandler(of({ statusCode: 500 }));

      await firstValueFrom(interceptor.intercept(mockContext({ statusCode: 500 }), next));

      expect(loggerError).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/gists 500 \d+ms — 127\.0\.0\.1$/),
      );
      expect(loggerLog).not.toHaveBeenCalled();
      expect(loggerWarn).not.toHaveBeenCalled();
    });
  });

  describe('error path', () => {
    it('logs the failure through logger.error and rethrows', async () => {
      const next = mockCallHandler(throwError(() => new Error('db down')));

      await expect(firstValueFrom(interceptor.intercept(mockContext(), next))).rejects.toThrow(
        'db down',
      );

      expect(loggerError).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/gists ERROR \d+ms — db down$/),
      );
      expect(loggerLog).not.toHaveBeenCalled();
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('still measures the duration of a failing handler', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000);
      nowSpy.mockReturnValueOnce(5000).mockReturnValueOnce(5015);
      const next = mockCallHandler(throwError(() => new Error('timeout')));

      await expect(firstValueFrom(interceptor.intercept(mockContext(), next))).rejects.toThrow(
        'timeout',
      );

      expect(loggerError).toHaveBeenCalledWith('GET /gists ERROR 15ms — timeout');
    });
  });
});

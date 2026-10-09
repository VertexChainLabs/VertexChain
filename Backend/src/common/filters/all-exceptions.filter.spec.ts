import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let loggerError: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;
  let response: { status: jest.Mock; json: jest.Mock };
  let request: { url: string; method: string };
  let host: ArgumentsHost;
  const originalNodeEnv = process.env.NODE_ENV;

  const setNodeEnv = (value: string | undefined): void => {
    if (value === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = value;
  };

  const catchAndBody = (exception: unknown): Record<string, unknown> => {
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
    return response.json.mock.calls[0][0] as Record<string, unknown>;
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    loggerError = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
    loggerWarn = jest.spyOn((filter as any).logger, 'warn').mockImplementation(() => undefined);

    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    request = { url: '/gists?limit=10', method: 'GET' };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    setNodeEnv('development');
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    jest.restoreAllMocks();
  });

  describe('response envelope', () => {
    it('writes statusCode, timestamp, path and message', () => {
      const body = catchAndBody(new BadRequestException('Invalid cell'));

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(body.path).toBe('/gists?limit=10');
      expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
      expect(typeof body.message).toBe('string');
    });

    it('responds with the status returned by the HttpException', () => {
      catchAndBody(new NotFoundException());

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });
  });

  describe('HttpException mapping', () => {
    it('uses the exception message when the response payload carries one', () => {
      const body = catchAndBody(new BadRequestException('Invalid cell'));

      expect(body.message).toBe('Invalid cell');
    });

    it('uses the default message when the exception is constructed without one', () => {
      const body = catchAndBody(new NotFoundException());

      expect(body.message).toBe('Not Found');
    });

    it('passes a plain string response straight through', () => {
      const body = catchAndBody(new HttpException('I am a teapot', 418));

      expect(response.status).toHaveBeenCalledWith(418);
      expect(body.message).toBe('I am a teapot');
    });

    it('preserves an array of validation messages', () => {
      const message = ['lat must be a number', 'lon must be a number'];
      const body = catchAndBody(new HttpException({ message }, 400));

      expect(body.message).toEqual(message);
    });

    it('falls back to exception.message when the payload has no message key', () => {
      const exception = new HttpException({ reason: 'quota' }, HttpStatus.SERVICE_UNAVAILABLE);
      const body = catchAndBody(exception);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body.message).toBe(exception.message);
    });

    it('routes 5xx HttpExceptions through logger.error without a stack in production', () => {
      setNodeEnv('production');
      const exception = new HttpException({ message: 'Upstream unavailable' }, 502);

      catchAndBody(exception);

      expect(loggerError).toHaveBeenCalledWith('GET /gists?limit=10 → 502', '');
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('routes 4xx HttpExceptions through logger.warn with a JSON encoded message', () => {
      const body = catchAndBody(new BadRequestException('Invalid cell'));

      expect(loggerWarn).toHaveBeenCalledWith('GET /gists?limit=10 → 400: "Invalid cell"');
      expect(loggerError).not.toHaveBeenCalled();
      expect(body.message).toBe('Invalid cell');
    });
  });

  describe('unknown exceptions', () => {
    it('returns 500 with the original message outside production', () => {
      setNodeEnv('development');
      const exception = new Error('connection refused');

      const body = catchAndBody(exception);

      expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe('connection refused');
    });

    it('returns 500 with the stack when logging outside production', () => {
      setNodeEnv('development');
      const exception = new Error('connection refused');

      catchAndBody(exception);

      expect(loggerError).toHaveBeenCalledWith('GET /gists?limit=10 → 500', exception.stack);
    });

    it('masks the message in production', () => {
      setNodeEnv('production');
      const exception = new Error('connection refused: password=hunter2');

      const body = catchAndBody(exception);

      expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe('Internal server error');
      expect(JSON.stringify(body)).not.toContain('hunter2');
    });

    it('drops the stack in production', () => {
      setNodeEnv('production');

      catchAndBody(new Error('boom'));

      expect(loggerError).toHaveBeenCalledWith('GET /gists?limit=10 → 500', '');
    });

    it('falls back to "Unknown error" for a thrown non-Error value', () => {
      setNodeEnv('development');

      const body = catchAndBody('boom');

      expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body.message).toBe('Unknown error');
    });

    it('masks non-Error values in production too', () => {
      setNodeEnv('production');

      const body = catchAndBody('boom');

      expect(body.message).toBe('Internal server error');
    });
  });

  describe('status based logging', () => {
    it('logs 5xx responses through logger.error, never logger.warn', () => {
      catchAndBody(new InternalServerErrorException('nope'));

      expect(loggerError).toHaveBeenCalledTimes(1);
      expect(loggerWarn).not.toHaveBeenCalled();
    });

    it('includes the HttpException stack for 5xx responses outside production', () => {
      setNodeEnv('development');
      const exception = new InternalServerErrorException('nope');

      catchAndBody(exception);

      expect(loggerError).toHaveBeenCalledWith('GET /gists?limit=10 → 500', exception.stack);
    });

    it('uses the request method and url in the log line', () => {
      request = { url: '/gists', method: 'POST' };

      catchAndBody(new BadRequestException('Invalid cell'));

      expect(loggerWarn).toHaveBeenCalledWith('POST /gists → 400: "Invalid cell"');
    });
  });
});

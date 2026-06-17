import { HttpException, HttpStatus } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';

export const csrfCookieParser = cookieParser();

export const csrfProtection = csurf({
  cookie: {
    key: process.env.CSRF_COOKIE_NAME ?? 'csrfToken',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 1000,
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req: Request) =>
    (req.headers['x-csrf-token'] as string) ||
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf),
});

export function csrfErrorHandler(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'EBADCSRFTOKEN') {
    next(new HttpException('Invalid or missing CSRF token', HttpStatus.FORBIDDEN));
    return;
  }

  next(err);
}

// Issue 95 — Security headers (CSP, COOP, Permissions-Policy, Referrer-Policy)
// Applied as a NestJS/Express middleware on every response.
// Production headers lock down the origin to prevent cross-origin leaks;
// CSP allows the Leaflet tiles CDN required by the frontend.
import { NextFunction, Request, Response } from 'express';

const IS_PROD = process.env.NODE_ENV === 'production';

// CSP: allow same-origin + Leaflet tiles (maps) + local dev frontend
const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",        // Leaflet injects inline styles
  "img-src 'self' data: https://*.tile.openstreetmap.org",
  "connect-src 'self'" + (IS_PROD ? '' : ' http://localhost:3001'),
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader('Content-Security-Policy', CSP_VALUE);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  next();
}

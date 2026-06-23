/**
 * Tests for the GET /api/health liveness probe.
 *
 * Follow-up to PR #87 (`docker: add multi-stage frontend Dockerfile with
 * Next.js standalone output`) so the Next.js App Router endpoint matches
 * the Docker HEALTHCHECK expectations in `docker/frontend.Dockerfile`.
 *
 * The route is exercised by `wget --spider` against
 * `http://127.0.0.1:${PORT}/api/health`, so we assert only the
 * duck-typed Web Response shape — no `instanceof` checks against Next.js
 * internal classes, because vitest's module-resolution surface differs
 * from the production runtime and `instanceof NextResponse` is not
 * guaranteed to survive that.
 */
import { describe, it, expect } from 'vitest'
import { GET, dynamic } from './route'

describe('GET /api/health', () => {
  it('returns status 200', () => {
    const response = GET()
    expect(response.status).toBe(200)
  })

  it('returns application/json content type', () => {
    const response = GET()
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
  })

  it('returns body with status: "ok" and an ISO 8601 timestamp', async () => {
    const response = GET()
    const body = await response.json()

    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date')
    // Strict ISO 8601 UTC: 2024-05-04T12:34:56.789Z
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})

describe('route module config', () => {
  it('exports dynamic = "force-dynamic" so Next.js does not pre-render the route', () => {
    expect(dynamic).toBe('force-dynamic')
  })
})

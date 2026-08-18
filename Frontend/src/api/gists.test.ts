import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GistPayload, GistResponse } from './gists';

const mockFetch = vi.fn();

let postGist: typeof import('./gists').postGist;
let GistApiError: typeof import('./gists').GistApiError;

const validPayload: GistPayload = {
  content: 'Test gist',
  lat: 6.5244,
  lon: 3.3792,
};

const mockResponse: GistResponse = {
  id: 'gist-123',
  content: 'Test gist',
  lat: 6.5244,
  lon: 3.3792,
  author: null,
  created_at: '2026-07-28T12:00:00Z',
};

const csrfOk = (token: string) => ({
  ok: true,
  json: () => Promise.resolve({ csrfToken: token }),
});

const postOk = () => ({
  ok: true,
  json: () => Promise.resolve(mockResponse),
});

// The module memoizes the CSRF token at module scope, so reset the module
// registry before each test to get a clean cache.
beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;

  const mod = await import('./gists');
  postGist = mod.postGist;
  GistApiError = mod.GistApiError;
});

describe('postGist', () => {
  it('should POST to /gists with credentials, CSRF token, and JSON content-type', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload);

    // First call: GET /csrf-token with credentialed fetch.
    const [csrfUrl, csrfOptions] = mockFetch.mock.calls[0];
    expect(csrfUrl).toBe('http://localhost:3000/csrf-token');
    expect(csrfOptions.method).toBe('GET');
    expect(csrfOptions.credentials).toBe('include');

    // Second call: POST /gists with the token and credentials.
    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toBe('http://localhost:3000/gists');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['x-csrf-token']).toBe('token-1');
  });

  it('should send an Idempotency-Key header on every post', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload);

    const [, options] = mockFetch.mock.calls[1];
    expect(typeof options.headers['Idempotency-Key']).toBe('string');
    expect(options.headers['Idempotency-Key'].length).toBeGreaterThan(0);
  });

  it('should reuse a caller-supplied idempotency key', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload, { idempotencyKey: 'key-123' });

    const [, options] = mockFetch.mock.calls[1];
    expect(options.headers['Idempotency-Key']).toBe('key-123');
  });

  it('should return the server-confirmed gist on success', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    const result = await postGist(validPayload);
    expect(result).toEqual(mockResponse);
  });

  it('should fetch the CSRF token once and reuse it across posts', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk())
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload);
    await postGist(validPayload);

    const csrfCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/csrf-token'),
    );
    expect(csrfCalls).toHaveLength(1);

    const [, firstOptions] = mockFetch.mock.calls[1];
    const [, secondOptions] = mockFetch.mock.calls[2];
    expect(firstOptions.headers['x-csrf-token']).toBe('token-1');
    expect(secondOptions.headers['x-csrf-token']).toBe('token-1');
  });

  it('should refetch once and retry when a stale-token 403 is returned', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('stale-token'))
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Invalid or missing CSRF token'),
      })
      .mockResolvedValueOnce(csrfOk('fresh-token'))
      .mockResolvedValueOnce(postOk());

    const result = await postGist(validPayload);
    expect(result).toEqual(mockResponse);

    // Two /csrf-token fetches: the initial one plus one after the 403.
    const csrfCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/csrf-token'),
    );
    expect(csrfCalls).toHaveLength(2);

    // The retry POST carries the freshly fetched token.
    const [, retryOptions] = mockFetch.mock.calls[3];
    expect(retryOptions.headers['x-csrf-token']).toBe('fresh-token');
  });

  it('should throw GistApiError when a 403 persists after refetch and retry', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('stale-token'))
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Invalid or missing CSRF token'),
      })
      .mockResolvedValueOnce(csrfOk('fresh-token'))
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Invalid or missing CSRF token'),
      });

    let caught: unknown;
    try {
      await postGist(validPayload);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(GistApiError);
    expect((caught as InstanceType<typeof GistApiError>).status).toBe(403);
  });

  it('should include author in the payload when provided', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    const payloadWithAuthor: GistPayload = {
      ...validPayload,
      author: 'anonymous-raccoon',
    };

    await postGist(payloadWithAuthor);

    const [, options] = mockFetch.mock.calls[1];
    const body = JSON.parse(options.body);
    expect(body.author).toBe('anonymous-raccoon');
  });

  it('should throw GistApiError with status when response is not ok', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Validation failed'),
      });

    let caught: unknown;
    try {
      await postGist(validPayload);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(GistApiError);
    expect((caught as InstanceType<typeof GistApiError>).status).toBe(422);
    expect((caught as InstanceType<typeof GistApiError>).name).toBe(
      'GistApiError',
    );
    expect((caught as InstanceType<typeof GistApiError>).message).toContain(
      'POST /gists failed (422)',
    );
  });

  it('should handle errors where text() fails', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('Body stream already read')),
      });

    await expect(postGist(validPayload)).rejects.toThrow(
      'POST /gists failed (500): Unable to read response body',
    );
  });

  it('should throw on network failure', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(postGist(validPayload)).rejects.toThrow('Failed to fetch');
  });

  it('should serialize the payload as JSON', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload);

    const [, options] = mockFetch.mock.calls[1];
    const body = JSON.parse(options.body);
    expect(body.content).toBe('Test gist');
    expect(body.lat).toBe(6.5244);
    expect(body.lon).toBe(3.3792);
  });

  it('should default to localhost:3000 when NEXT_PUBLIC_API_URL is not set', async () => {
    mockFetch
      .mockResolvedValueOnce(csrfOk('token-1'))
      .mockResolvedValueOnce(postOk());

    await postGist(validPayload);

    const [url] = mockFetch.mock.calls[1];
    expect(url).toBe('http://localhost:3000/gists');
  });
});

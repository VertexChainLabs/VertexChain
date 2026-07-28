import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postGist, GistApiError, GistPayload, GistResponse } from './gists';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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

describe('postGist', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should POST to the correct endpoint with JSON content-type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await postGist(validPayload);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/gists');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('should return the server-confirmed gist on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await postGist(validPayload);
    expect(result).toEqual(mockResponse);
  });

  it('should include author in the payload when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const payloadWithAuthor: GistPayload = {
      ...validPayload,
      author: 'anonymous-raccoon',
    };

    await postGist(payloadWithAuthor);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.author).toBe('anonymous-raccoon');
  });

  it('should throw GistApiError with status when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
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
    expect((caught as GistApiError).status).toBe(422);
    expect((caught as GistApiError).name).toBe('GistApiError');
    expect((caught as GistApiError).message).toContain('POST /gists failed (422)');
  });

  it('should handle errors where text() fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('Body stream already read')),
    });

    await expect(postGist(validPayload)).rejects.toThrow(
      'POST /gists failed (500): Unable to read response body',
    );
  });

  it('should throw on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(postGist(validPayload)).rejects.toThrow('Failed to fetch');
  });

  it('should serialize the payload as JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await postGist(validPayload);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.content).toBe('Test gist');
    expect(body.lat).toBe(6.5244);
    expect(body.lon).toBe(3.3792);
  });

  it('should default to localhost:3000 when NEXT_PUBLIC_API_URL is not set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await postGist(validPayload);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/gists');
  });
});

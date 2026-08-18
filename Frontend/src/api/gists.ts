// =============================================================================
// Gists API — typed client for the VertexChain backend POST /gists endpoint.
// =============================================================================

export interface GistPayload {
  content: string;
  lat: number;
  lon: number;
  author?: string;
}

export interface GistResponse {
  id: string;
  content: string;
  lat: number;
  lon: number;
  author: string | null;
  created_at: string;
  stellar_gist_id?: string | null;
}

export class GistApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GistApiError";
  }
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface PostGistOptions {
  /**
   * Stable key reused across retries of the same logical post so the backend
   * can deduplicate a mid-write failure instead of minting a second gist.
   */
  idempotencyKey?: string;
}

function generateIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/**
 * Memoized in-flight promise for the CSRF token. The backend uses a
 * double-submit cookie: `GET /csrf-token` sets the httpOnly `csrfToken`
 * cookie (the secret) and returns the token to echo back in the
 * `x-csrf-token` header. We fetch once and reuse the token, sharing the
 * in-flight promise so concurrent posts trigger a single fetch.
 */
let csrfTokenPromise: Promise<string> | null = null;

/**
 * Fetch a fresh CSRF token from `/csrf-token`. `credentials: 'include'` is
 * required so the httpOnly secret cookie is set and later replayed.
 */
async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/csrf-token`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    let body: string;
    try {
      body = await res.text();
    } catch {
      body = "Unable to read response body";
    }
    throw new GistApiError(
      `GET /csrf-token failed (${res.status}): ${body}`,
      res.status,
    );
  }

  const json = (await res.json()) as { csrfToken?: string };
  if (!json.csrfToken) {
    throw new GistApiError("GET /csrf-token returned no token");
  }
  return json.csrfToken;
}

/** Return the memoized CSRF token, fetching it on first use. */
function ensureCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken();
  }
  return csrfTokenPromise;
}

/** Drop the memoized token so the next call fetches a fresh one. */
function invalidateCsrfToken(): void {
  csrfTokenPromise = null;
}

/** POST the payload with the CSRF token, idempotency key, and credentialed fetch. */
async function postGistRequest(
  payload: GistPayload,
  token: string,
  idempotencyKey: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/gists`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": token,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * POST a new gist to the backend.
 *
 * Returns the server-confirmed gist on success.
 * Throws a {@link GistApiError} on network failure or non-2xx response.
 */
export async function postGist(
  payload: GistPayload,
  options: PostGistOptions = {},
): Promise<GistResponse> {
  const idempotencyKey = options.idempotencyKey ?? generateIdempotencyKey();

  let token = await ensureCsrfToken();
  let res = await postGistRequest(payload, token, idempotencyKey);

  // The backend may rotate the double-submit cookie; a 403 can mean the cached
  // token is stale. Refetch once and retry before surfacing the error.
  if (res.status === 403) {
    invalidateCsrfToken();
    token = await ensureCsrfToken();
    res = await postGistRequest(payload, token, idempotencyKey);
  }

  if (!res.ok) {
    let body: string;
    try {
      body = await res.text();
    } catch {
      body = "Unable to read response body";
    }
    throw new GistApiError(
      `POST /gists failed (${res.status}): ${body}`,
      res.status,
    );
  }

  return res.json() as Promise<GistResponse>;
}

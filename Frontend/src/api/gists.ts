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
 * POST a new gist to the backend.
 *
 * Returns the server-confirmed gist on success.
 * Throws a {@link GistApiError} on network failure or non-2xx response.
 */
export async function postGist(
  payload: GistPayload,
  options: PostGistOptions = {},
): Promise<GistResponse> {
  const url = `${BASE_URL}/gists`;
  const idempotencyKey = options.idempotencyKey ?? generateIdempotencyKey();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

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

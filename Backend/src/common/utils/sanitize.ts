import DOMPurify from 'isomorphic-dompurify';

/**
 * Strip HTML tags and dangerous content from a string to prevent XSS.
 * Uses DOMPurify with an empty allowlist so output is always plain text.
 * Preserves plain text, unicode, and emojis.
 */
export function stripHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
}

import * as sanitizeHtml from 'sanitize-html';

/**
 * Strip all HTML from a string so the result is safe, inert plain text.
 *
 * Backend-side defence-in-depth against stored XSS: user-supplied fields
 * (bio, displayName, tip messages) are reduced to text before persistence.
 *
 * Implementation notes:
 *  - `sanitize-html` is pure Node (no jsdom / no DOM globals), so it runs
 *    correctly under the NestJS `node` Jest environment. The previous
 *    `isomorphic-dompurify` approach pulled in jsdom + an ESM-only transitive
 *    (`@exodus/bytes`) that crashed `ts-jest` at import time.
 *  - `allowedTags: []` discards every element. Script/style/textarea/option
 *    content is dropped wholesale (sanitize-html `nonTextTags` default).
 *  - The output keeps `<`/`>` HTML-encoded so the result is inert even if a
 *    downstream consumer interpolates it into raw HTML. Only harmless
 *    punctuation entities are decoded back to readable characters.
 */
export function stripHtml(input: string): string {
  if (!input) {
    return '';
  }

  const stripped = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });

  // sanitize-html encodes special chars. Decode only the safe punctuation
  // entities; leave `&lt;` / `&gt;` encoded so no active markup can survive.
  return stripped
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Strip user-generated content: removes HTML tags AND Unicode bidi control characters.
 *
 * Removes bidirectional text override characters (U+202A–U+202E, U+2066–U+2069)
 * that can flip display order and break perceived trust in anonymous platforms.
 *
 * Preserves:
 *  - All printable Unicode (including accented characters, CJK, etc.)
 *  - Emoji and emoji ZWJ sequences
 *  - Standard whitespace and newlines
 *
 * @param input - Raw user content
 * @returns Sanitized plain text without HTML or bidi controls
 */
export function stripUserContent(input: string): string {
  // First strip HTML
  const noHtml = stripHtml(input);

  // Remove Unicode bidi control characters:
  // U+202A (LRE) - Left-to-Right Embedding
  // U+202B (RLE) - Right-to-Left Embedding
  // U+202C (PDF) - Pop Directional Formatting
  // U+202D (LRO) - Left-to-Right Override
  // U+202E (RLO) - Right-to-Left Override
  // U+2066 (LRI) - Left-to-Right Isolate
  // U+2067 (RLI) - Right-to-Left Isolate
  // U+2068 (FSI) - First Strong Isolate
  // U+2069 (PDI) - Pop Directional Isolate
  return noHtml.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
}

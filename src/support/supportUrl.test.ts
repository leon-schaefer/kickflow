import { describe, expect, it } from 'vitest';
import { resolveSupportUrl } from './supportUrl';

describe('resolveSupportUrl', () => {
  it('nimmt eine https-URL unverändert an', () => {
    expect(resolveSupportUrl('https://ko-fi.com/kickflow')).toBe('https://ko-fi.com/kickflow');
    expect(resolveSupportUrl('https://ko-fi.com')).toBe('https://ko-fi.com');
    expect(resolveSupportUrl('https://example.com/spenden?ref=app#tip')).toBe(
      'https://example.com/spenden?ref=app#tip',
    );
  });

  it('trimmt Whitespace — Env-Werte tragen gern ein Leerzeichen oder Newline mit', () => {
    expect(resolveSupportUrl('  https://ko-fi.com/kickflow  ')).toBe('https://ko-fi.com/kickflow');
    expect(resolveSupportUrl('https://ko-fi.com/kickflow\n')).toBe('https://ko-fi.com/kickflow');
  });

  it('behandelt eine nicht gesetzte Variable als "keine Unterstützen-Karte"', () => {
    expect(resolveSupportUrl(undefined)).toBeNull();
    expect(resolveSupportUrl(null)).toBeNull();
    expect(resolveSupportUrl('')).toBeNull();
    expect(resolveSupportUrl('   ')).toBeNull();
  });

  it('weist alles zurück, was nicht https ist', () => {
    // http: Spendenseiten mit Zahlungsdaten gehören nie über Klartext.
    expect(resolveSupportUrl('http://ko-fi.com/kickflow')).toBeNull();
    // Die eigentlichen Kandidaten für einen Unfall: window.open und
    // Linking.openURL führen beide aus, was hier durchkäme.
    expect(resolveSupportUrl('javascript:alert(1)')).toBeNull();
    expect(resolveSupportUrl('file:///etc/passwd')).toBeNull();
    // Tippfehler in der Env-Variable statt einer URL.
    expect(resolveSupportUrl('ko-fi.com/kickflow')).toBeNull();
    expect(resolveSupportUrl('https://')).toBeNull();
  });

  it('lässt sich nicht durch führenden Whitespace im Schema austricksen', () => {
    expect(resolveSupportUrl('java\nscript:alert(1)')).toBeNull();
    expect(resolveSupportUrl('https:// ko-fi.com/kickflow')).toBeNull();
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
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

/**
 * Wächter über .env.local.example.
 *
 * Warum eine Vorlagendatei einen Test braucht: sie ist die einzige
 * Dokumentation, wie die App konfiguriert wird, und ein falscher Name darin
 * bricht NICHTS — er lässt nur eine Variable setzen, die niemand liest. Genau
 * das war der Fall: die Vorlage nannte `EXPO_PUBLIC_SUPPORT_URL` weiter, seit
 * dem Umzug auf Vite liest supportUrl.ts aber `VITE_SUPPORT_URL`. Der Build
 * blieb grün, `npm test` blieb grün, und die Unterstützen-Karte blieb
 * unsichtbar — bei jemandem, der alles richtig gemacht hatte.
 *
 * Geprüft wird gegen den Quelltext von supportUrl.ts und nicht gegen eine
 * Konstante hier: eine dritte Kopie des Namens wäre dieselbe Drift noch
 * einmal.
 */
describe('.env.local.example', () => {
  const ROOT = path.join(import.meta.dirname, '..', '..');
  const example = readFileSync(path.join(ROOT, '.env.local.example'), 'utf8');
  const source = readFileSync(path.join(ROOT, 'src', 'support', 'supportUrl.ts'), 'utf8');

  /** Der Name, den der Code tatsächlich liest. */
  const readName = /import\.meta\.env\.([A-Z0-9_]+)/.exec(source)?.[1];

  it('dokumentiert genau die Variable, die der Code liest', () => {
    expect(readName).toBe('VITE_SUPPORT_URL');
    // Am Zeilenanfang und mit `=`: ein Vorkommen im Begründungstext darüber
    // soll den Test nicht erfüllen.
    expect(example).toMatch(new RegExp(`^${readName}=`, 'm'));
  });

  it('setzt keinen Namen mehr, den Vite gar nicht durchreicht', () => {
    // Vite reicht ausschließlich `VITE_*` an den Client (envPrefix-Default).
    // Ein `EXPO_PUBLIC_*` als gesetzte Variable ist damit immer ein Rest aus
    // der Migration und immer wirkungslos.
    expect(example).not.toMatch(/^EXPO_PUBLIC_[A-Z0-9_]*=/m);
  });

  it('lässt die Kickbase-Zugangsdaten ohne Client-Präfix', () => {
    // KICKBASE_EMAIL/-PASSWORD gehören scripts/probe.ts und dürfen NIE in den
    // Client wandern. Ein `VITE_`-Präfix davor würde genau das tun, lautlos.
    expect(example).toMatch(/^KICKBASE_EMAIL=/m);
    expect(example).toMatch(/^KICKBASE_PASSWORD=/m);
    expect(example).not.toMatch(/^VITE_KICKBASE_/m);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAST_LEAGUE_KEY, SESSION_KEY, excludedFromSaleKey, leagueRulesKey } from './keys';

/**
 * Wächter über die localStorage-Schlüssel.
 *
 * Der Umstieg von AsyncStorage auf rohes localStorage ist datenkompatibel,
 * weil AsyncStorage auf Web den Schlüssel unverändert durchreicht. Damit das
 * so bleibt, sind die Strings hier wörtlich fixiert — ein Rename beim Port
 * wäre sonst ein stiller Datenverlust bei jedem Nutzer (Regeln,
 * Verkaufs-Ausschlüsse, „Zuletzt genutzt").
 *
 * Zusätzlich wird gegen die Dateien geprüft, die die Schlüssel heute noch
 * selbst bauen — solange sie das tun, dürfen beide Seiten nicht auseinander
 * laufen. Muster wie src/updates/registerSw.test.ts, das public/register-sw.js
 * von der Platte liest.
 */
const SRC = path.join(import.meta.dirname, '..');

function read(relative: string): string {
  return readFileSync(path.join(SRC, relative), 'utf8');
}

describe('localStorage-Schlüssel', () => {
  it('stehen wörtlich fest', () => {
    expect(SESSION_KEY).toBe('kickflow.session.v1');
    expect(LAST_LEAGUE_KEY).toBe('kickflow.lastLeagueId');
    expect(leagueRulesKey('42')).toBe('kickflow.rules.v1.42');
    expect(excludedFromSaleKey('42')).toBe('kickflow.excludedFromSale.v1.42');
  });

  it('sind pro Liga getrennt', () => {
    expect(leagueRulesKey('1')).not.toBe(leagueRulesKey('2'));
    expect(excludedFromSaleKey('1')).not.toBe(excludedFromSaleKey('2'));
  });

  it('decken sich mit den Modulen, die ihre Schlüssel noch selbst bauen', () => {
    // Fällt weg, sobald die drei Module keys.ts importieren — bis dahin ist
    // das die einzige Verbindung zwischen beiden Seiten.
    expect(read('auth/tokenStore.ts')).toContain(SESSION_KEY);
    expect(read('leagues/lastLeague.ts')).toContain(LAST_LEAGUE_KEY);
    expect(read('lineup/useLeagueRules.ts')).toContain('kickflow.rules.v1.');
    expect(read('lineup/useExcludedFromSale.ts')).toContain('kickflow.excludedFromSale.v1.');
  });
});

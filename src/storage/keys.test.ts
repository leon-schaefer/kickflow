import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INSTALL_HINT_KEY,
  LAST_LEAGUE_KEY,
  SESSION_KEY,
  excludedFromSaleKey,
  leagueRulesKey,
} from './keys';

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
    expect(INSTALL_HINT_KEY).toBe('kickflow.installHint.v1');
  });

  it('sind pro Liga getrennt', () => {
    expect(leagueRulesKey('1')).not.toBe(leagueRulesKey('2'));
    expect(excludedFromSaleKey('1')).not.toBe(excludedFromSaleKey('2'));
  });

  it('werden nirgends sonst als Literal gebaut', () => {
    // Alle Speicher-Module beziehen ihre Schlüssel aus diesem Modul. Ein
    // zweites Literal irgendwo im Baum wäre genau die Drift, gegen die die
    // Tests oben schützen sollen — deshalb hier die Gegenprobe.
    for (const relative of [
      'auth/tokenStore.ts',
      'leagues/lastLeague.ts',
      'lineup/useLeagueRules.ts',
      'lineup/useExcludedFromSale.ts',
      'pwa/useInstallHint.ts',
    ]) {
      const source = read(relative);
      expect(source, `${relative} baut Schlüssel selbst`).not.toMatch(/'kickflow\./);
      expect(source, `${relative} importiert nicht aus @/storage/keys`).toContain(
        "from '@/storage/keys'",
      );
    }
  });
});

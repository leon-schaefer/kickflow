import { describe, expect, it } from 'vitest';
import { STORAGE_INVENTORY, STORAGE_KEY_PREFIX } from './inventory';
import * as keys from './keys';
import { APP_KEY_PREFIX } from './keys';

/**
 * Hält die Speicher-Auskunft der Datenschutzerklärung an der Wirklichkeit.
 *
 * Der Test, auf den es ankommt, ist der erste: er liest die EXPORTE von
 * keys.ts (nicht eine Liste hier) und verlangt für jeden einen Eintrag in
 * inventory.ts. Ein neuer localStorage-Schlüssel bricht damit `npm test`, und
 * zwar mit einer Meldung, die sagt, was zu tun ist — statt still eine
 * Rechtsseite falsch werden zu lassen, die niemand mehr liest, nachdem sie
 * einmal geschrieben war.
 *
 * `import * as keys` ist hier der Punkt und nicht Bequemlichkeit: nur so sieht
 * der Test Schlüssel, die es zum Zeitpunkt seines Schreibens noch nicht gab.
 */
describe('Speicher-Inventar', () => {
  /**
   * Jeder Schlüssel-Export aus keys.ts, aufgelöst zu dem String, der im
   * localStorage landet. Die Funktionen (pro Liga) bekommen denselben
   * Platzhalter, den inventory.ts benutzt.
   */
  const PLACEHOLDER = '<Liga-ID>';
  const actualKeys = Object.entries(keys)
    .filter(([name]) => name !== 'APP_KEY_PREFIX')
    .map(([name, value]) => ({
      name,
      key: typeof value === 'function' ? (value as (id: string) => string)(PLACEHOLDER) : value,
    }));

  it('kennt jeden Schlüssel, den keys.ts exportiert', () => {
    // Absichtlich keine Zahl („5 Einträge"): eine Zahl müsste bei jedem neuen
    // Schlüssel mit angehoben werden und sagt nicht, welcher fehlt.
    const described = new Set(STORAGE_INVENTORY.map((e) => e.key));
    const missing = actualKeys.filter(({ key }) => !described.has(key));
    expect(
      missing.map(({ name, key }) => `${name} (${key})`),
      'Neuer Schlüssel in keys.ts — inventory.ts braucht einen Eintrag dafür, sonst ist die Datenschutzerklärung unvollständig',
    ).toEqual([]);
  });

  it('beschreibt keinen Schlüssel, den es nicht mehr gibt', () => {
    // Die andere Richtung: ein entfernter Schlüssel darf nicht als „wird
    // gespeichert" stehen bleiben. Eine Auskunft, die zu viel behauptet, ist
    // genauso falsch wie eine, die zu wenig nennt.
    const real = new Set(actualKeys.map(({ key }) => key));
    const stale = STORAGE_INVENTORY.filter((e) => !real.has(e.key));
    expect(stale.map((e) => e.key)).toEqual([]);
  });

  it('erklärt jeden Eintrag in ganzen Sätzen', () => {
    for (const entry of STORAGE_INVENTORY) {
      expect(entry.label.length, entry.key).toBeGreaterThan(0);
      // Die Tabelle richtet sich an Nutzer, nicht an Entwickler — ein
      // Stichwort wie „Session-State" wäre keine Auskunft. Die Untergrenze ist
      // grob, sie soll nur einen leeren oder hingeworfenen Wert abfangen.
      expect(entry.purpose.length, `${entry.key}: purpose zu knapp`).toBeGreaterThan(40);
      expect(entry.lifetime.length, `${entry.key}: lifetime zu knapp`).toBeGreaterThan(10);
    }
  });

  it('markiert die Anmeldung als personenbezogen und sonst nichts', () => {
    // Genau ein Eintrag trägt personenbezogene Daten (Token, Nutzer-ID,
    // Anzeigename). Wenn ein zweiter dazukommt, ist das eine
    // datenschutzrechtlich relevante Änderung und soll hier auffallen, nicht
    // beim Lesen der Seite.
    const personal = STORAGE_INVENTORY.filter((e) => e.personal).map((e) => e.key);
    expect(personal).toEqual([keys.SESSION_KEY]);
  });

  it('nennt das echte Präfix, über das gelöscht wird', () => {
    // Die Rechtsseite schreibt „alles, was mit <Präfix> anfängt". Der Satz
    // stimmt nur, solange das hier derselbe Wert ist wie der, den
    // localStore.clearAppData() benutzt.
    expect(STORAGE_KEY_PREFIX).toBe(APP_KEY_PREFIX);
    for (const entry of STORAGE_INVENTORY) {
      expect(entry.key.startsWith(APP_KEY_PREFIX), `${entry.key} ohne Präfix`).toBe(true);
    }
  });
});

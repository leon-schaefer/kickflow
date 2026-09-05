// @vitest-environment jsdom
//
// Der dokumentierte Notausgang aus vite.config.ts: eine `.test.ts`, die doch
// DOM braucht. Das Modul ist keine Komponente, `.test.tsx` wäre irreführend.

import { afterEach, describe, expect, it, vi } from 'vitest';
import localStore from './local';

/**
 * Prüft vor allem das Verhalten, das der Ersatz für AsyncStorage NEU mitbringt:
 * jeder Zugriff ist gekapselt. Im privaten Modus und bei blockierten
 * Site-Daten wirft schon der Zugriff auf `window.localStorage` — vorher galt
 * dieser Schutz nur beim Lesen der Session, Schreiben und Löschen liefen
 * ungeschützt.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** Ersetzt localStorage durch eine Variante, die bei jedem Zugriff wirft. */
function breakStorage() {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new DOMException('blocked');
    },
    setItem() {
      throw new DOMException('blocked');
    },
    removeItem() {
      throw new DOMException('blocked');
    },
  });
}

describe('localStore', () => {
  it('schreibt und liest denselben Wert', async () => {
    await localStore.setItem('kickflow.test', 'wert');
    expect(await localStore.getItem('kickflow.test')).toBe('wert');
  });

  it('liefert null für einen Schlüssel, der nie geschrieben wurde', async () => {
    expect(await localStore.getItem('kickflow.gibt-es-nicht')).toBeNull();
  });

  it('entfernt einen Wert', async () => {
    await localStore.setItem('kickflow.test', 'wert');
    await localStore.removeItem('kickflow.test');
    expect(await localStore.getItem('kickflow.test')).toBeNull();
  });

  it('liefert null statt zu werfen, wenn der Speicher gesperrt ist', async () => {
    breakStorage();
    await expect(localStore.getItem('kickflow.test')).resolves.toBeNull();
  });

  it('scheitert still beim Schreiben, wenn der Speicher gesperrt ist', async () => {
    breakStorage();
    // Kein Reject: der Wert liegt für diese Sitzung im State, nur nicht
    // dauerhaft. Ein werfender Aufruf würde stattdessen den Screen
    // mitreißen — beim Umschalten eines Verkaufs-Ausschlusses etwa.
    await expect(localStore.setItem('kickflow.test', 'wert')).resolves.toBeUndefined();
    await expect(localStore.removeItem('kickflow.test')).resolves.toBeUndefined();
  });
});

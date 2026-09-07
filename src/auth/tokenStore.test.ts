// @vitest-environment jsdom
//
// Der dokumentierte Notausgang aus vite.config.ts (siehe local.test.ts): eine
// `.test.ts`, die doch DOM braucht — hier den localStorage hinter dem Store.

import { afterEach, describe, expect, it } from 'vitest';
import { SESSION_KEY } from '@/storage/keys';
import { clearSession, getSession, setSession } from './tokenStore';

afterEach(() => {
  window.localStorage.clear();
});

describe('tokenStore', () => {
  it('speichert Identität mit, nicht nur den Token', async () => {
    // Der Kern der Sache: an `userId` hängen die eigene Zeile der
    // Liga-Tabelle und der Duell-Gegner. Lag sie nur im State, war sie nach
    // jedem Reload weg.
    await setSession({ token: 't', refreshToken: 'r', userId: '42', userName: 'Ich' });

    await expect(getSession()).resolves.toEqual({
      token: 't',
      refreshToken: 'r',
      userId: '42',
      userName: 'Ich',
    });
  });

  it('liest Alt-Einträge ohne Identität als "unbekannt", nicht als kaputt', async () => {
    // So sah der Eintrag vor der Persistierung aus — er darf niemanden
    // abmelden, nur die ID ist eben nicht bekannt.
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 't', refreshToken: null }));

    await expect(getSession()).resolves.toEqual({
      token: 't',
      refreshToken: null,
      userId: null,
      userName: null,
    });
  });

  it('behandelt einen kaputten Eintrag wie "nicht angemeldet"', async () => {
    window.localStorage.setItem(SESSION_KEY, '{nicht json');
    await expect(getSession()).resolves.toBeNull();
  });

  it('behandelt einen Eintrag ohne Token wie "nicht angemeldet"', async () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: '42' }));
    await expect(getSession()).resolves.toBeNull();
  });

  it('gibt ohne Eintrag null', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('löscht die Session', async () => {
    await setSession({ token: 't', refreshToken: null, userId: '42', userName: 'Ich' });
    await clearSession();
    await expect(getSession()).resolves.toBeNull();
  });
});

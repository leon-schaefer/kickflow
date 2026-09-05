import { SESSION_KEY } from '@/storage/keys';
import localStore from '@/storage/local';

/**
 * Token liegt im localStorage. Für JavaScript lesbar und damit nicht
 * XSS-sicher — ohne eigenen Server gibt es im Browser keine Alternative,
 * deshalb die strikte CSP in vercel.json (`script-src 'self'`, kein
 * `unsafe-inline`).
 *
 * Der Zugriff läuft über src/storage/local.ts, das die Ausnahmen abfängt: im
 * privaten Modus und bei blockierten Site-Daten wirft schon der Zugriff auf
 * `window.localStorage`. Vorher galt das hier nur beim Lesen — Schreiben und
 * Löschen liefen ungeschützt.
 */
export interface StoredSession {
  token: string;
  refreshToken: string | null;
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await localStore.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    // Kaputter Eintrag (von Hand verändert, abgebrochener Schreibvorgang) —
    // wie "nicht angemeldet" behandeln, nicht werfen.
    return null;
  }
}

export async function setSession(session: StoredSession): Promise<void> {
  return localStore.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  return localStore.removeItem(SESSION_KEY);
}

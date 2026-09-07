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
  /**
   * Eigene Kickbase-User-ID, mitgespeichert statt nur im Speicher gehalten:
   * daran hängt, welche Zeile der Liga-Tabelle die eigene ist und wer der
   * Duell-Gegner ist (siehe src/screens/LeagueScreen.tsx). Lag sie nur im
   * State, war sie nach jedem Reload weg — der Liga-Tab zeigte dann bis zum
   * nächsten Login weder die eigene Zeile noch das Duell.
   *
   * `null` heißt "nicht bekannt", nicht "kein Login": Alt-Einträge von vor
   * dieser Persistierung tragen das Feld nicht, und die Login-Antwort selbst
   * liefert `u.id` nur laut unverifizierter Doku (siehe toAuthSession).
   */
  userId: string | null;
  /** Anzeigename, aus demselben Grund mitgespeichert (siehe MoreScreen). */
  userName: string | null;
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await localStore.getItem(SESSION_KEY);
  if (!raw) return null;
  let parsed: Partial<StoredSession> | null;
  try {
    parsed = JSON.parse(raw) as Partial<StoredSession> | null;
  } catch {
    // Kaputter Eintrag (von Hand verändert, abgebrochener Schreibvorgang) —
    // wie "nicht angemeldet" behandeln, nicht werfen.
    return null;
  }
  if (!parsed?.token) return null;
  // Feldweise aufbauen statt den geparsten Wert durchzureichen: Einträge von
  // vor `userId`/`userName` tragen die Felder nicht, und `undefined` würde
  // sich im AuthProvider nicht von "wird noch geladen" unterscheiden.
  return {
    token: parsed.token,
    refreshToken: parsed.refreshToken ?? null,
    userId: parsed.userId ?? null,
    userName: parsed.userName ?? null,
  };
}

export async function setSession(session: StoredSession): Promise<void> {
  return localStore.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  return localStore.removeItem(SESSION_KEY);
}

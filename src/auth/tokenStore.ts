/**
 * Token liegt im localStorage. Für JavaScript lesbar und damit nicht
 * XSS-sicher — ohne eigenen Server gibt es im Browser keine Alternative,
 * deshalb die strikte CSP in vercel.json (`script-src 'self'`, kein
 * `unsafe-inline`).
 */
const STORAGE_KEY = 'kickflow.session.v1';

export interface StoredSession {
  token: string;
  refreshToken: string | null;
}

export async function getSession(): Promise<StoredSession | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function setSession(session: StoredSession): Promise<void> {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  window.localStorage.removeItem(STORAGE_KEY);
}

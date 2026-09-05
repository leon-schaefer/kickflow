import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as kickbaseLogin } from '@/api/kickbase';
import { queryClient } from '@/queries/queryClient';
import * as tokenStore from './tokenStore';
import { onUnauthorized } from './unauthorizedBus';

interface AuthState {
  /** undefined = wird noch aus dem Store geladen, null = kein Login. */
  token: string | null | undefined;
  userName: string | null;
  /**
   * Eigene Kickbase-User-ID — nur für die Dauer der Session im Speicher, wie
   * `userName` NICHT persistiert (tokenStore speichert nur token/refreshToken).
   * Nach einem App-Neustart also wieder `null`, bis erneut eingeloggt wird.
   * Gebraucht, um die eigene Zeile in der Liga-Tabelle zu markieren (siehe
   * src/screens/LeagueScreen.tsx).
   */
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Vom API-Client bei jedem 401/403 aufgerufen — löscht die Session sofort. */
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    tokenStore.getSession().then((session) => {
      setToken(session?.token ?? null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await kickbaseLogin(email, password);
    await tokenStore.setSession({ token: session.token, refreshToken: session.refreshToken });
    // Cache des vorherigen Kontos wegwerfen. Nach einem 401 landet man ohne
    // Umweg über logout() wieder hier, und `useLeagues()` hat staleTime 5 min
    // bei refetchOnWindowFocus: false — ohne clear() sähe das neue Konto
    // zuerst die Ligen des alten, ohne dass nachgeladen wird.
    queryClient.clear();
    setUserName(session.userName);
    setUserId(session.userId);
    setToken(session.token);
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.clearSession();
    // Gegenstück zum clear() in login(): nach dem Abmelden soll nichts vom
    // Konto im Speicher zurückbleiben. Bewusst nicht in handleUnauthorized —
    // das läuft aus QueryCache.onError heraus und zöge der gerade
    // fehlschlagenden Query den Boden weg.
    queryClient.clear();
    setUserName(null);
    setToken(null);
  }, []);

  const handleUnauthorized = useCallback(() => {
    tokenStore.clearSession();
    setToken(null);
  }, []);

  // Der QueryClient meldet einen 401/403 hier statt über ein Hook-onError
  // (das gibt es für useQuery in TanStack Query v5 nicht mehr).
  useEffect(() => onUnauthorized(handleUnauthorized), [handleUnauthorized]);

  const value = useMemo(
    () => ({ token, userName, userId, login, logout, handleUnauthorized }),
    [token, userName, userId, login, logout, handleUnauthorized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() muss innerhalb von <AuthProvider> aufgerufen werden.');
  return ctx;
}

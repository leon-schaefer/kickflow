import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as kickbaseLogin } from '@/api/kickbase';
import * as tokenStore from './tokenStore';
import { onUnauthorized } from './unauthorizedBus';

interface AuthState {
  /** undefined = wird noch aus dem Store geladen, null = kein Login. */
  token: string | null | undefined;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Vom API-Client bei jedem 401/403 aufgerufen — löscht die Session sofort. */
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    tokenStore.getSession().then((session) => {
      setToken(session?.token ?? null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await kickbaseLogin(email, password);
    await tokenStore.setSession({ token: session.token, refreshToken: session.refreshToken });
    setUserName(session.userName);
    setToken(session.token);
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.clearSession();
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
    () => ({ token, userName, login, logout, handleUnauthorized }),
    [token, userName, login, logout, handleUnauthorized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() muss innerhalb von <AuthProvider> aufgerufen werden.');
  return ctx;
}

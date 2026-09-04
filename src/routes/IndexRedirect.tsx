import { Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/Spinner';

/**
 * `/` ist ein reiner Verteiler — Ersatz für app/index.tsx.
 *
 * Wie im Gate gilt: bei `undefined` warten, nicht raten. Ein Redirect auf
 * /login wäre hier genauso falsch wie dort.
 */
export function IndexRedirect() {
  const { token } = useAuth();

  if (token === undefined) return <Spinner fill />;

  return <Navigate to={token ? '/leagues' : '/login'} replace />;
}

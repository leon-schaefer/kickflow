import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/Spinner';

/**
 * Das einzige Auth-Gate der App — Ersatz für app/(app)/_layout.tsx.
 *
 * Als pathless Layout-Route eingehängt: sie gruppiert alles, was einen Login
 * braucht, ohne in der URL zu erscheinen. Das ist das genaue Äquivalent zur
 * Klammer-Gruppe `(app)` in expo-router.
 *
 * Die Dreiwertigkeit von `token` ist der Kern und darf nicht zu einem
 * Boolean vereinfacht werden:
 *
 *   undefined — die Session wird noch aus dem Speicher geladen
 *   null      — kein Login
 *   string    — angemeldet
 *
 * Ohne den `undefined`-Zweig würde ein Reload mitten in der App den Nutzer
 * für einen Frame auf /login werfen, bevor die Session geladen ist.
 */
export function RequireAuth() {
  const { token } = useAuth();

  if (token === undefined) return <Spinner fill />;
  if (token === null) return <Navigate to="/login" replace />;

  return <Outlet />;
}

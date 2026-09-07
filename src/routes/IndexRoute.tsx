import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Spinner } from '@/components/Spinner';
import { isStandalone } from '@/pwa/standalone';
import { LandingScreen } from '@/screens/LandingScreen';

/**
 * Was an `/` passiert. Hieß bis zur öffentlichen Startseite `IndexRedirect`
 * und war genau das — inzwischen ist der Redirect nur noch zwei von drei
 * Fällen.
 *
 * Die Reihenfolge ist die Aussage:
 *
 *  1. `token === undefined` heißt „Session wird geladen", nicht „kein Login".
 *     Wie im Auth-Gate gilt: warten, nicht raten. Ein Redirect auf /login wäre
 *     hier genauso falsch wie dort.
 *  2. Angemeldet -> Ligenliste. Unverändert, und der häufigste Fall: die
 *     `start_url` im Manifest ist `/`, jeder Start der installierten PWA läuft
 *     hier durch.
 *  3. Abgemeldet in der installierten PWA -> Login. Wer die App auf dem
 *     Startbildschirm hat, ist geworben; ihm nach einem Logout oder einem
 *     abgelaufenen Token eine Werbeseite statt des Logins zu zeigen, wäre eine
 *     Zumutung — und in der PWA gibt es keine Adressleiste, über die er sie
 *     umgehen könnte.
 *  4. Abgemeldet im Browser-Tab -> die Startseite. Das ist der Fremde, der den
 *     geteilten Link angetippt hat.
 *
 * `useState(isStandalone)` und nicht bei jedem Render neu: aus einem Tab wird
 * ohne Neustart keine installierte PWA (dieselbe Überlegung wie in
 * src/pwa/useInstallHint.ts). Der Hook steht dabei VOR den frühen Returns,
 * sonst wechselt die Hook-Reihenfolge zwischen Lade- und Endzustand.
 */
export function IndexRoute() {
  const { token } = useAuth();
  const [standalone] = useState(isStandalone);

  if (token === undefined) return <Spinner fill />;
  if (token) return <Navigate to="/leagues" replace />;
  if (standalone) return <Navigate to="/login" replace />;

  return <LandingScreen />;
}

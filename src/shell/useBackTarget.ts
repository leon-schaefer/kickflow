import { useLocation } from 'react-router';
import { leagueTabTitles } from '@/leagues/leagueTabs';

export interface BackTarget {
  to: string;
  label: string;
}

/**
 * Herkunft einer Navigation, im `state` von `navigate()` mitgegeben.
 * Siehe `withOrigin()`.
 */
export interface NavOrigin {
  fromPath?: string;
  fromTitle?: string;
}

/**
 * Ziel und Label des Zurück-Wegs eines Detail-Screens.
 *
 * Ersetzt `useFocusedLeagueTabTitle`, das dafür via
 * `useNavigation().getState()` den React-Navigation-State introspektiert hat
 * — die einzige Stelle im Repo, die das tat, und in React Router gibt es
 * dafür kein Gegenstück. Stattdessen gibt der Aufrufer seine Herkunft beim
 * Navigieren explizit mit.
 *
 * Das ist zugleich genauer als vorher: der Sonderfall „Spielerprofil aus der
 * Manager-Ansicht" (früher die `leagueStackTitles`-Sonderregel) ergibt sich
 * hier von selbst.
 *
 * Fallback wie bisher: ohne Herkunft — also bei einem Deep Link direkt aufs
 * Detail — führt Zurück auf den ersten Tab, und der heißt „Aufstellung".
 * Bewusst kein `navigate(-1)`: in einer aus der PWA heraus geöffneten
 * History gibt es keinen Eintrag, auf den es zurückgehen könnte.
 */
export function useBackTarget(leagueId: string): BackTarget {
  const { state } = useLocation();
  const origin = (state ?? null) as NavOrigin | null;

  return {
    to: safeInternalPath(origin?.fromPath) ?? `/${leagueId}/lineup`,
    label: origin?.fromTitle ?? leagueTabTitles.lineup,
  };
}

/**
 * Nur app-interne Pfade zulassen. `location.state` überlebt einen Reload und
 * lässt sich über die History-API auch von außen setzen — ein Wert wie
 * `https://…` oder `//host` würde sonst als Ziel eines `<Link>` aus der App
 * herausführen.
 */
function safeInternalPath(path: string | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

/**
 * Baut den `state` für `navigate()`, damit der Zielscreen weiß, wohin sein
 * Zurück führt. Der Titel ist der des ausgehenden Screens.
 */
export function withOrigin(fromPath: string, fromTitle: string): { state: NavOrigin } {
  return { state: { fromPath, fromTitle } };
}

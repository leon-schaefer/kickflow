import { Outlet, useParams } from 'react-router';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import styles from './LeagueLayout.module.css';

/**
 * Alles unter `/:leagueId` — Ersatz für app/(app)/[leagueId]/_layout.tsx.
 *
 * Der `key` ist kein Beiwerk, sondern ein Vertrag: ohne Remount beim
 * Liga-Wechsel bleibt ein noch nicht gespeicherter Aufstellungs-Entwurf der
 * ALTEN Liga montiert und könnte an die neue gesendet werden. Der
 * LeagueSwitcher navigiert mit `replace`, die Route bleibt also dieselbe —
 * React würde den Baum sonst weiterverwenden. Wie bisher sitzt der `key`
 * innerhalb des LeagueIdProvider, auf dem Inhalt.
 *
 * `LeagueRulesProvider` und `ExcludedFromSaleProvider` kommen zurück, sobald
 * ihre Speicher-Hooks von AsyncStorage auf localStorage umgestellt sind — sie
 * lassen sich sonst nicht ohne React Native bündeln.
 */
export function LeagueLayout() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <LeagueIdProvider id={leagueId}>
      <div key={leagueId} className={styles.content}>
        <Outlet />
      </div>
    </LeagueIdProvider>
  );
}

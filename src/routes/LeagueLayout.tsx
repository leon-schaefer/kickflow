import { Outlet, useParams } from 'react-router';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { ExcludedFromSaleProvider } from '@/lineup/ExcludedFromSaleContext';
import { LeagueRulesProvider } from '@/lineup/LeagueRulesContext';
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
 * Die beiden Speicher-Provider liegen wie bisher ÜBER dem Inhalt: der
 * Regel-State ist zwischen dem Aufstellungs-Tab und dem `rules`-Screen
 * darüber geteilt, und der Verkaufs-Ausschluss wird auf dem Spieler-Detail
 * umgeschaltet und wirkt im Aufstellungs-Tab (siehe LeagueRulesContext bzw.
 * ExcludedFromSaleContext).
 */
export function LeagueLayout() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <LeagueIdProvider id={leagueId}>
      <LeagueRulesProvider leagueId={leagueId ?? ''}>
        <ExcludedFromSaleProvider leagueId={leagueId ?? ''}>
          <div key={leagueId} className={styles.content}>
            <Outlet />
          </div>
        </ExcludedFromSaleProvider>
      </LeagueRulesProvider>
    </LeagueIdProvider>
  );
}

import { useState } from 'react';
import { AssistantBubble } from '@/assistant/AssistantBubble';
import { Outlet, useParams } from 'react-router';
import { LeagueIdProvider } from '@/leagues/LeagueIdContext';
import { ExcludedFromSaleProvider } from '@/lineup/ExcludedFromSaleContext';
import { LeagueRulesProvider } from '@/lineup/LeagueRulesContext';
import { LineupDraftProvider } from '@/lineup/LineupDraftContext';
import { OptimizerSettingsProvider } from '@/lineup/OptimizerSettingsContext';
import { PlayerListViewProvider } from '@/players/PlayerListViewContext';
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
 * Der LineupDraftProvider liegt dagegen INNERHALB des `key`: er hält den
 * ungespeicherten Aufstellungs-Entwurf, damit ein Abstecher auf `rules` oder
 * ein Spielerprofil ihn nicht verwirft (siehe LineupDraftContext) — und genau
 * dieser Entwurf ist es, den der `key` beim Liga-Wechsel wegräumen soll.
 *
 * Aus demselben Grund liegt der PlayerListViewProvider dort: er hält Filter
 * und Sortierung von Spieler- und Markt-Tab über den Abstecher aufs
 * Spielerprofil hinweg, und seine Vereins-Chips gehören zum Wettbewerb der
 * aktuellen Liga (siehe PlayerListViewContext).
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
          <LeagueFrame key={leagueId} />
        </ExcludedFromSaleProvider>
      </LeagueRulesProvider>
    </LeagueIdProvider>
  );
}

function LeagueFrame() {
  const [tabContent, setTabContent] = useState<HTMLDivElement | null>(null);

  return (
    <div className={styles.content}>
      <LineupDraftProvider>
        <OptimizerSettingsProvider>
          <PlayerListViewProvider>
            <Outlet context={setTabContent} />
            <AssistantBubble target={tabContent} />
          </PlayerListViewProvider>
        </OptimizerSettingsProvider>
      </LineupDraftProvider>
    </div>
  );
}

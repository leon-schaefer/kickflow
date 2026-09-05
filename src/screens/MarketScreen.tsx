import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { MarketPlayer } from '@/api/kickbase';
import { BudgetBar } from '@/components/BudgetBar';
import { LeagueSwitcher } from '@/components/LeagueSwitcher';
import { MarketRow } from '@/components/MarketRow';
import { OfferModal } from '@/components/OfferModal';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips, SortChipsDivider } from '@/components/SortChips';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCompetitionTeams, useLeagues, useMarket, usePlaytimes } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { withOrigin } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import { formatCountdown, msUntil } from '@/utils/format';
import { filterOwnBids, sortByExpiry } from '@/utils/marketList';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from '@/utils/playerFilter';
import {
  metricForSort,
  metricLabels,
  metricNeedsPlaytime,
  metricValue,
  type PlayerSortKey,
} from '@/utils/playerMetric';
import rowStyles from '@/components/PlayerRowFrame.module.css';
import layout from '@/theme/layout.module.css';
import styles from './MarketScreen.module.css';

// Modul-Konstante statt inline `[]`: usePlaytimes/useQueries brauchen eine
// referenziell stabile ID-Liste, sonst baut useQueries sie bei jedem Render neu.
const NO_PLAYTIME_IDS: string[] = [];

const SORT_OPTIONS: { key: PlayerSortKey; label: string }[] = [
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
  { key: 'pointsPerMinute', label: metricLabels.pointsPerMinute.chip },
  { key: 'expiry', label: 'Ablauf' },
];

export function MarketScreen() {
  const leagueId = useLeagueId();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<PlayerSortKey>('avgPerMillion');
  const [onlyOwnBids, setOnlyOwnBids] = useState(false);
  const [offerTarget, setOfferTarget] = useState<MarketPlayer | null>(null);
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);
  const limit = useBudgetLimit();
  const competitionId = useCompetitionId();
  const teamsQuery = useCompetitionTeams(competitionId);

  const market = useMarket(leagueId);
  const leaguesQuery = useLeagues();
  const rawPlayers: MarketPlayer[] = market.data?.players ?? [];

  // Countdown-Anzeige lebendig halten, ohne dafür zu pollen (kein Netzwerk-
  // Request) — gleicher Trick wie der Deadline-Countdown im Aufstellungs-Tab.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const marketValueUpdateMs = market.data ? msUntil(market.data.marketValueUpdateAt) : null;

  // Die Spielminuten (ein Request PRO SPIELER) nur laden, wenn die aktive
  // Sortierung sie tatsächlich braucht — aus der UNGEFILTERTEN Liste, sonst
  // würde jeder Filter-Tap sie neu anfragen.
  const needsPlaytime = metricNeedsPlaytime(metricForSort(sortKey, 'avgPerMillion'));
  const playerIds = useMemo(
    () => (needsPlaytime ? rawPlayers.map((player) => player.id) : NO_PLAYTIME_IDS),
    [rawPlayers, needsPlaytime],
  );
  const playtimeState = usePlaytimes(leagueId, playerIds);
  const { playtimes } = playtimeState;

  // BudgetBar hängt an useBudgetLimit -> leaguesQuery gehört mit in den Pull,
  // auch wenn dieser Screen ihre Daten sonst nicht direkt anzeigt.
  const refresh = useRefresh(market, leaguesQuery, playtimeState);

  const statMetric = metricForSort(sortKey, 'avgPerMillion');

  const sorted = useMemo(() => {
    const filtered = filterPlayers(rawPlayers, filter);
    const base = onlyOwnBids ? filterOwnBids(filtered) : filtered;
    if (sortKey === 'expiry') return sortByExpiry(base);
    return [...base].sort(
      (a, b) =>
        metricValue(b, statMetric, playtimes.get(b.id)) -
        metricValue(a, statMetric, playtimes.get(a.id)),
    );
  }, [rawPlayers, sortKey, statMetric, playtimes, onlyOwnBids, filter]);

  function openPlayer(player: MarketPlayer) {
    // Die Herkunft geht als state mit — daraus baut der Detail-Screen sein
    // Zurück-Ziel samt Beschriftung (siehe useBackTarget).
    navigate(
      `/${leagueId}/player/${player.id}`,
      withOrigin(`/${leagueId}/market`, leagueTabTitles.market),
    );
  }

  return (
    <>
      <AppHeader title={<LeagueSwitcher />} />

      <PlayerFilterBar criteria={filter} onChange={setFilter} teams={teamsQuery.data} />

      <SortChips
        options={SORT_OPTIONS}
        value={sortKey}
        onChange={setSortKey}
        leading={
          <>
            <button
              type="button"
              aria-pressed={onlyOwnBids}
              className={cx(layout.pressable, styles.sortChip)}
              onClick={() => setOnlyOwnBids((value) => !value)}
            >
              Nur meine Gebote
            </button>
            <SortChipsDivider />
          </>
        }
      />

      {marketValueUpdateMs != null && marketValueUpdateMs > 0 && (
        <p className={styles.hint}>
          Nächstes Marktwert-Update in {formatCountdown(marketValueUpdateMs)}
        </p>
      )}

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <p className={styles.hint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </p>
      )}

      {limit && <BudgetBar limit={limit} />}

      {!market.data ? (
        <QueryState query={market} label="Transfermarkt" refresh={refresh} />
      ) : (
        <Refreshable {...refresh}>
          {(p) => (
            <div {...p} className={styles.scroll}>
              {sorted.length === 0 ? (
                <div className={styles.center}>
                  {/* Eigener Text bei aktivem Filter — „Keine Spieler gefunden"
                      würde hier wie ein Ladefehler wirken. */}
                  <p className={styles.emptyText}>
                    {onlyOwnBids
                      ? 'Du hast auf keinen Spieler geboten.'
                      : isPlayerFilterActive(filter)
                        ? 'Kein Spieler passt zum Filter.'
                        : 'Keine Spieler gefunden.'}
                  </p>
                </div>
              ) : (
                <ul className={styles.list}>
                  {sorted.map((player) => (
                    <li key={player.id} className={rowStyles.separated}>
                      <MarketRow
                        player={player}
                        playtime={playtimes.get(player.id)}
                        metric={statMetric}
                        onClick={openPlayer}
                        onBid={setOfferTarget}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Refreshable>
      )}

      <OfferModal player={offerTarget} onClose={() => setOfferTarget(null)} />
    </>
  );
}

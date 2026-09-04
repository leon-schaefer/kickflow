import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router';
import type { CompetitionPlayer, Team } from '@/api/kickbase';
import { CompetitionPlayerRow } from '@/components/CompetitionPlayerRow';
import { LeagueSwitcher } from '@/components/LeagueSwitcher';
import { PlayerFilterBar } from '@/components/PlayerFilterBar';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SortChips, SortChipsDivider } from '@/components/SortChips';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import {
  useCompetitionPlayers,
  useCompetitionTeams,
  useLineup,
  useMarket,
  usePlaytimes,
} from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { withOrigin } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { EMPTY_PLAYER_FILTER, filterPlayers, isPlayerFilterActive } from '@/utils/playerFilter';
import {
  metricForSort,
  metricLabels,
  metricNeedsPlaytime,
  metricValue,
  type PlayerMetric,
  type PlayerSortKey,
} from '@/utils/playerMetric';
import type { PlayerOrigin } from '@/utils/playerOwnership';
import { playerOrigins } from '@/utils/playerOwnership';
import type { PlaytimeTotals } from '@/utils/playtime';
import type { RefreshableChildProps } from '@/components/Refreshable.types';
import layout from '@/theme/layout.module.css';
import styles from './PlayersScreen.module.css';

// Modul-Konstante statt inline `[]`: usePlaytimes/useQueries brauchen eine
// referenziell stabile ID-Liste, sonst baut useQueries sie bei jedem Render neu.
const NO_PLAYTIME_IDS: string[] = [];

/**
 * Geschätzte Zeilenhöhe für den Virtualizer. Die echte Höhe misst er selbst
 * nach (`measureElement`), der Wert bestimmt nur die anfängliche Scrollhöhe.
 */
const ROW_HEIGHT = 60;

const SORT_OPTIONS: { key: PlayerSortKey; label: string; dividerBefore?: boolean }[] = [
  { key: 'marketValue', label: 'Marktwert' },
  { key: 'totalPoints', label: 'Punkte' },
  { key: 'avgPoints', label: 'Ø Punkte' },
  { key: 'avgPerMillion', label: metricLabels.avgPerMillion.chip, dividerBefore: true },
  { key: 'totalPerMillion', label: metricLabels.totalPerMillion.chip },
];

/**
 * Punkte/Min gibt es NUR mit aktivem Kader-Filter: die Kennzahl kostet einen
 * `/performance`-Request pro Spieler (siehe usePlaytimes). Über den eigenen
 * Kader sind das ~20 Requests, über den gesamten Bestand wären es ~500 —
 * deshalb hängt der Chip am Filter und nicht an der Trefferzahl: eine
 * Kennzahl, die beim Tippen im Suchfeld erscheint und verschwindet, wäre
 * nicht bedienbar.
 */
const PLAYTIME_SORT_OPTION: { key: PlayerSortKey; label: string; dividerBefore?: boolean } = {
  key: 'pointsPerMinute',
  label: metricLabels.pointsPerMinute.chip,
};

/**
 * Alle Spieler der Competition — der einzige Screen, der auch Spieler zeigt,
 * die weder im eigenen Kader stehen noch im Transfermarkt gelistet sind.
 *
 * Suche, Filter und Sortierung laufen rein lokal auf dem geladenen Bestand —
 * deshalb wird er komplett geholt (ein Request je Verein, 30 Minuten frisch)
 * statt serverseitig zu suchen: nur so greifen Vereins-/Positionsfilter und
 * die Wert-Kennzahlen über den GESAMTEN Bestand statt über eine Trefferliste.
 *
 * Die ~500 Zeilen sind der Grund für den Virtualizer. Er ersetzt genau das,
 * was die FlatList hier geleistet hat; ein `.map()` über alle Zeilen wäre eine
 * echte Performance-Regression. Bewusst nicht `content-visibility`: die Liste
 * hat einen eigenen Scroll-Container und braucht eine korrekte
 * Scrollbar-Höhe.
 */
export function PlayersScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const navigate = useNavigate();

  const teamsQuery = useCompetitionTeams(competitionId);
  // Stabil memoisiert: die Liste geht als Argument in getCompetitionPlayers.
  const teamIds = useMemo(() => (teamsQuery.data ?? []).map((team) => team.id), [teamsQuery.data]);
  const playersQuery = useCompetitionPlayers(competitionId, teamIds);

  // Kader-Filter und Herkunftshinweise an der Zeile. Beide Queries gehören
  // ohnehin zur App (Aufstellung/Markt) und werden über ihren Key geteilt —
  // nur ein Kaltstart direkt auf diesem Tab löst sie tatsächlich aus.
  const lineupQuery = useLineup(leagueId);
  const marketQuery = useMarket(leagueId);

  const [sortKey, setSortKey] = useState<PlayerSortKey>('marketValue');
  const [filter, setFilter] = useState<PlayerFilterCriteria>(EMPTY_PLAYER_FILTER);
  const [onlyMySquad, setOnlyMySquad] = useState(false);

  const mySquadIds = useMemo(
    () => (lineupQuery.data?.players ?? []).map((player) => player.id),
    [lineupQuery.data],
  );

  const origins = useMemo(
    () =>
      playerOrigins(
        mySquadIds,
        (marketQuery.data?.players ?? []).map((player) => player.id),
      ),
    [mySquadIds, marketQuery.data],
  );

  const teamsById = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team])),
    [teamsQuery.data],
  );

  const metric = metricForSort(sortKey, 'marketValue');

  // Der Kader-Filter greift VOR Suche und Chips: er bestimmt die Grundmenge,
  // auf der auch die Spielzeit-Requests unten hängen.
  const pool = useMemo(() => {
    const players = playersQuery.data ?? [];
    if (!onlyMySquad) return players;
    const squadIds = new Set(mySquadIds);
    return players.filter((player) => squadIds.has(player.id));
  }, [playersQuery.data, onlyMySquad, mySquadIds]);

  // Spielminuten nur, wenn die aktive Sortierung sie braucht — und dann aus dem
  // UNGEFILTERTEN Pool, sonst würde jeder Tastendruck in der Suche sie neu
  // anfragen. Ohne Kader-Filter kann `metric` gar nicht 'pointsPerMinute' sein
  // (der Chip existiert dann nicht), die Menge bleibt also klein.
  const needsPlaytime = metricNeedsPlaytime(metric);
  const playtimeIds = useMemo(
    () => (needsPlaytime ? pool.map((player) => player.id) : NO_PLAYTIME_IDS),
    [pool, needsPlaytime],
  );
  const playtimeState = usePlaytimes(leagueId, playtimeIds);
  const { playtimes } = playtimeState;

  const visiblePlayers = useMemo(() => {
    const filtered = filterPlayers(pool, filter);
    return [...filtered].sort(
      (a, b) =>
        metricValue(b, metric, playtimes.get(b.id)) - metricValue(a, metric, playtimes.get(a.id)),
    );
  }, [pool, filter, metric, playtimes]);

  /**
   * Beim Abschalten des Kader-Filters muss eine aktive Punkte/Min-Sortierung
   * mit weg: der Chip verschwindet, und ohne diesen Reset liefen die
   * Spielzeit-Requests anschließend über den GESAMTEN Bestand.
   */
  function toggleMySquad() {
    const next = !onlyMySquad;
    setOnlyMySquad(next);
    if (!next && sortKey === 'pointsPerMinute') setSortKey('marketValue');
  }

  const refresh = useRefresh(teamsQuery, playersQuery, lineupQuery, marketQuery, playtimeState);

  function openPlayer(player: CompetitionPlayer) {
    navigate(
      `/${leagueId}/player/${player.id}`,
      withOrigin(`/${leagueId}/players`, leagueTabTitles.players),
    );
  }

  const header = <AppHeader title={<LeagueSwitcher />} />;

  // Die Vereinsliste ist Voraussetzung für den Bestand (ein Request je Verein)
  // — ohne sie wäre der Spielerquery dauerhaft deaktiviert und ein Spinner
  // ohne Erklärung stehen geblieben.
  if (!teamsQuery.data) {
    return (
      <>
        {header}
        <QueryState query={teamsQuery} label="Vereine" refresh={refresh} />
      </>
    );
  }
  // Eine leere Vereinsliste (`table` ohne `it`) hält den Spielerquery dauerhaft
  // deaktiviert — QueryState hätte dann keinen Fehler zu zeigen und würde
  // endlos drehen. Deshalb hier eine Aussage statt eines Spinners.
  if (teamsQuery.data.length === 0) {
    return (
      <>
        {header}
        <Refreshable {...refresh}>
          {(p) => (
            <div {...p} className={styles.scroll}>
              <div className={styles.center}>
                <p className={styles.emptyText}>
                  Für diese Liga sind keine Vereine bekannt — ohne sie lässt sich der
                  Spielerbestand nicht laden.
                </p>
              </div>
            </div>
          )}
        </Refreshable>
      </>
    );
  }
  if (!playersQuery.data) {
    return (
      <>
        {header}
        <QueryState query={playersQuery} label="Spielerbestand" refresh={refresh} />
      </>
    );
  }

  return (
    <>
      {header}

      <PlayerFilterBar criteria={filter} onChange={setFilter} teams={teamsQuery.data} />

      <SortChips
        options={onlyMySquad ? [...SORT_OPTIONS, PLAYTIME_SORT_OPTION] : SORT_OPTIONS}
        value={sortKey}
        onChange={setSortKey}
        leading={
          <>
            <button
              type="button"
              aria-pressed={onlyMySquad}
              className={cx(layout.pressable, styles.filterChip)}
              onClick={toggleMySquad}
            >
              Mein Kader
            </button>
            <SortChipsDivider />
          </>
        }
      />

      <p className={styles.countHint}>
        {visiblePlayers.length === playersQuery.data.length
          ? `${playersQuery.data.length} Spieler`
          : `${visiblePlayers.length} von ${playersQuery.data.length} Spielern`}
      </p>

      {/* Ohne diesen Hinweis wirkt das Nachsortieren während des Ladens wie ein Fehler. */}
      {playtimeState.pending > 0 && (
        <p className={styles.countHint}>
          Spielzeiten … {playtimeState.total - playtimeState.pending}/{playtimeState.total}
        </p>
      )}

      <Refreshable {...refresh}>
        {(p) => (
          <PlayerList
            scrollProps={p}
            players={visiblePlayers}
            metric={metric}
            teamsById={teamsById}
            origins={origins}
            playtimes={playtimes}
            onSelect={openPlayer}
            emptyText={
              onlyMySquad && !lineupQuery.data
                ? 'Kader wird geladen …'
                : onlyMySquad
                  ? 'Kein Spieler aus deinem Kader passt zum Filter.'
                  : isPlayerFilterActive(filter)
                    ? 'Kein Spieler passt zum Filter.'
                    : 'Keine Spieler gefunden.'
            }
          />
        )}
      </Refreshable>
    </>
  );
}

interface PlayerListProps {
  /** Die Render-Prop-Argumente von Refreshable — gehören an den Scroll-Container. */
  scrollProps: RefreshableChildProps;
  players: readonly CompetitionPlayer[];
  metric: PlayerMetric;
  teamsById: Map<string, Team>;
  origins: Map<string, PlayerOrigin>;
  playtimes: Map<string, PlaytimeTotals>;
  onSelect: (player: CompetitionPlayer) => void;
  /** Eigener Text je Ursache — „Keine Spieler gefunden" würde bei aktivem Kader-Filter wie ein Ladefehler wirken. */
  emptyText: string;
}

/**
 * Eigene Komponente, weil `useVirtualizer` einen Hook braucht und der
 * Render-Prop von Refreshable keine Hook-Grenze ist.
 */
function PlayerList({
  scrollProps,
  players,
  metric,
  teamsById,
  origins,
  playtimes,
  onSelect,
  emptyText,
}: PlayerListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // Ein Bildschirm Vorlauf, damit schnelles Scrollen keine Lücken zeigt.
    overscan: 8,
    getItemKey: (index) => players[index]!.id,
  });

  return (
    <div {...scrollProps} ref={scrollRef} className={styles.scroll}>
      {players.length === 0 ? (
        <div className={styles.center}>
          <p className={styles.emptyText}>{emptyText}</p>
        </div>
      ) : (
        // Der Sizer hält die Scrollhöhe aller Zeilen; die gerenderten liegen
        // absolut darin. Er braucht deshalb `position: relative`.
        <div className={styles.sizer} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const player = players[item.index]!;
            const team = teamsById.get(player.teamId);
            return (
              <div
                key={item.key}
                className={styles.rowSlot}
                style={{ transform: `translateY(${item.start}px)` }}
                ref={virtualizer.measureElement}
                data-index={item.index}
              >
                <CompetitionPlayerRow
                  player={player}
                  metric={metric}
                  teamName={team?.name}
                  teamLogoUrl={team?.logoUrl}
                  origin={origins.get(player.id)}
                  playtime={playtimes.get(player.id)}
                  onClick={onSelect}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

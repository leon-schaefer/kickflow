import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { TeamLogo } from '@/components/TeamLogo';
import { TransferBalanceSection } from '@/components/TransferBalanceSection';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useTransferHistories } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget, withOrigin } from '@/shell/useBackTarget';
import {
  groupByPosition,
  groupByTeam,
  MIN_APPEARANCES_FOR_AVERAGE,
  type PointSource,
  type RankMode,
  rankPointSources,
  type StatsGroup,
  totalPoints,
} from '@/stats/pointSources';
import { STATS_TITLE, statsPath } from '@/stats/statsRoute';
import { buildTransferSpells, summarizeTransfers } from '@/stats/transferBalance';
import { useSeasonPointSources } from '@/stats/useSeasonPointSources';
import { positionLabels } from '@/theme/tokens';
import { cx } from '@/utils/cx';
import { formatPoints } from '@/utils/format';
import layout from '@/theme/layout.module.css';
import styles from './StatsScreen.module.css';

type Dimension = 'player' | 'team' | 'position';

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'player', label: 'Spieler' },
  { key: 'team', label: 'Verein' },
  { key: 'position', label: 'Position' },
];

const RANK_MODES: { key: RankMode; label: string }[] = [
  { key: 'total', label: 'Gesamt' },
  { key: 'average', label: 'Ø je Einsatz' },
];

/**
 * „Von wem habe ich meine Punkte?" — die Auswertung, die Kickbase selbst nicht
 * hat: dort steht je Spieler, was er ÜBERHAUPT geholt hat, nicht was er in
 * MEINER Elf geholt hat. Der Unterschied ist die halbe Saison beim
 * Vorbesitzer, die Bank und jeder verkaufte Spieler.
 *
 * Erreichbar über die „Statistiken"-Zeile im Kopf des Aufstellungs-Tabs, neben
 * dem Restprogramm. Die Rechnung steht in src/stats/pointSources.ts, die
 * Datenbeschaffung in src/stats/useSeasonPointSources.ts — hier bleibt die
 * Darstellung.
 *
 * Der teuerste Screen der App: ein Request je gespieltem Spieltag plus einer je
 * Spieler, der je in der Elf stand. Beides ist gedrosselt (siehe limiter.ts)
 * und die Spieltagsabfragen sind dauerhaft frisch — eine abgeschlossene
 * Aufstellung ändert sich nicht mehr. Die Transferbilanz kostet noch einmal
 * einen Request je Spieler und lädt deshalb erst beim Aufklappen.
 */
export function StatsScreen() {
  const leagueId = useLeagueId();
  const navigate = useNavigate();
  const back = useBackTarget(leagueId);
  const [dimension, setDimension] = useState<Dimension>('player');
  const [rankMode, setRankMode] = useState<RankMode>('total');
  const [transfersOpen, setTransfersOpen] = useState(false);

  const season = useSeasonPointSources(leagueId);
  const transfers = useTransferHistories(leagueId, season.ownedPlayerIds, {
    enabled: transfersOpen,
  });
  const refresh = useRefresh(...season.refetchables, transfers);

  const players = useMemo(
    () => rankPointSources(season.sources, rankMode),
    [season.sources, rankMode],
  );
  const teamGroups = useMemo(
    () => groupByTeam(season.sources, season.teamNames),
    [season.sources, season.teamNames],
  );
  const positionGroups = useMemo(() => groupByPosition(season.sources), [season.sources]);

  const spells = useMemo(
    () =>
      buildTransferSpells({
        transfersByPlayer: transfers.transfersByPlayer,
        ownUserId: season.ownUserId,
        names: season.names,
        marketValues: season.marketValues,
        ownSquad: season.ownSquadIds,
      }),
    [
      transfers.transfersByPlayer,
      season.ownUserId,
      season.names,
      season.marketValues,
      season.ownSquadIds,
    ],
  );
  const summary = useMemo(() => summarizeTransfers(spells), [spells]);

  const counted = totalPoints(season.sources);
  const matchdayCount = season.playedDays.length - season.unresolvedDays.length;

  function openPlayer(playerId: string) {
    navigate(`/${leagueId}/player/${playerId}`, withOrigin(statsPath(leagueId), STATS_TITLE));
  }

  // Ein Header für alle Zweige, wie im Restprogramm — sonst wäre der
  // Zurück-Weg während des Ladens weg.
  const header = <AppHeader title={STATS_TITLE} back={back} />;

  if (!season.ready) {
    return (
      <>
        {header}
        <QueryState
          query={season.matchdaysQuery.data ? season.lineupQuery : season.matchdaysQuery}
          label="Statistiken"
          refresh={refresh}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            <div className={styles.content}>
              <section className={styles.summaryCard}>
                <h2 className={styles.summaryTitle}>Deine Punktequellen</h2>
                <p className={styles.summaryBody}>
                  Gezählt wird nur, was ein Spieler an den Spieltagen geholt hat, an denen er in
                  DEINER Elf stand — nicht seine Saisonpunkte.
                </p>
                <div className={styles.statRow}>
                  <Stat label="Erfasst" value={formatPoints(counted)} />
                  <Stat
                    label="Saisonpunkte"
                    value={season.seasonPoints === null ? '—' : formatPoints(season.seasonPoints)}
                  />
                  <Stat label="Spieltage" value={formatPoints(matchdayCount)} />
                </div>
                {season.pending > 0 && (
                  <p className={styles.hint} role="status">
                    Wird geladen — noch {season.pending} von {season.total} Abfragen.
                  </p>
                )}
                {season.unresolvedDays.length > 0 && (
                  <p className={styles.hint}>
                    Für {season.unresolvedDays.length} Spieltag
                    {season.unresolvedDays.length === 1 ? '' : 'e'} liegt keine Aufstellung von dir
                    vor; diese Punkte fehlen oben.
                  </p>
                )}
              </section>

              {season.playedDays.length === 0 ? (
                <p className={styles.emptyText}>
                  Noch kein Spieltag abgerechnet — die Auswertung beginnt nach dem ersten.
                </p>
              ) : (
                <>
                  <div className={styles.controlRow}>
                    <div className={styles.segmentGroup} role="group" aria-label="Auswertung">
                      {DIMENSIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={dimension === option.key}
                          className={cx(layout.pressable, styles.segmentChip)}
                          onClick={() => setDimension(option.key)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {dimension === 'player' && (
                      <div className={styles.segmentGroup} role="group" aria-label="Wertung">
                        {RANK_MODES.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            aria-pressed={rankMode === option.key}
                            className={cx(layout.pressable, styles.segmentChip)}
                            onClick={() => setRankMode(option.key)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {dimension === 'player' && rankMode === 'average' && (
                    <p className={styles.hint}>
                      Ab {MIN_APPEARANCES_FOR_AVERAGE} Einsätzen in deiner Elf — darunter sagt ein
                      Schnitt nichts.
                    </p>
                  )}

                  {dimension === 'player' ? (
                    <PlayerList
                      rows={players}
                      teamNames={season.teamNames}
                      teamLogos={season.teamLogos}
                      onSelect={openPlayer}
                    />
                  ) : (
                    <GroupList
                      rows={dimension === 'team' ? teamGroups : positionGroups}
                      logos={dimension === 'team' ? season.teamLogos : undefined}
                    />
                  )}
                </>
              )}

              <TransferBalanceSection
                spells={spells}
                summary={summary}
                pending={transfers.pending}
                attributable={!!season.ownUserId}
                onExpandedChange={setTransfersOpen}
                onSelectPlayer={openPlayer}
              />
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </span>
  );
}

function PlayerList({
  rows,
  teamNames,
  teamLogos,
  onSelect,
}: {
  rows: readonly PointSource[];
  teamNames: ReadonlyMap<string, string>;
  teamLogos: ReadonlyMap<string, string | null>;
  onSelect: (playerId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className={styles.emptyText}>Noch keine Spieler mit Einsätzen in deiner Elf.</p>;
  }

  return (
    <ol className={styles.list}>
      {rows.map((row, index) => (
        <li key={row.playerId}>
          <button
            type="button"
            className={cx(layout.pressableH, styles.row)}
            onClick={() => onSelect(row.playerId)}
          >
            <span className={styles.rank}>{index + 1}</span>
            <TeamLogo uri={teamLogos.get(row.teamId) ?? null} size={22} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{row.name}</span>
              <span className={styles.rowMeta}>
                {positionLabels[row.position]} · {teamNames.get(row.teamId) || '—'} ·{' '}
                {row.appearances} Einsätze
              </span>
            </span>
            <span className={styles.rowValue}>
              <span className={styles.rowPoints}>{formatPoints(row.points)}</span>
              <span className={styles.rowAverage}>Ø {formatAverage(row.averagePoints)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function GroupList({
  rows,
  logos,
}: {
  rows: readonly StatsGroup[];
  logos?: ReadonlyMap<string, string | null>;
}) {
  if (rows.length === 0) {
    return <p className={styles.emptyText}>Noch nichts auszuwerten.</p>;
  }

  return (
    <ol className={styles.list}>
      {rows.map((row, index) => (
        <li key={row.key} className={styles.row}>
          <span className={styles.rank}>{index + 1}</span>
          {logos && <TeamLogo uri={logos.get(row.key) ?? null} size={22} />}
          <span className={styles.rowText}>
            <span className={styles.rowName}>{row.label}</span>
            <span className={styles.rowMeta}>
              {row.playerCount} Spieler · {row.appearances} Einsätze
            </span>
          </span>
          <span className={styles.rowValue}>
            <span className={styles.rowPoints}>{formatPoints(row.points)}</span>
            <span className={styles.rowAverage}>Ø {formatAverage(row.averagePoints)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Ø-Punkte mit einer Nachkommastelle. Eigener Formatter statt
 * `formatValueScore`: der heißt nach seiner Kennzahl (Punkte je Mio) und wäre
 * an dieser Fundstelle eine falsche Fährte — dieselbe Trennung wie im
 * Restprogramm, das seinen Härte-Schnitt auch selbst formatiert.
 */
function formatAverage(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

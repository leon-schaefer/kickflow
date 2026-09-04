import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { PlayerTransfer } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { Checkbox } from '@/components/Checkbox';
import { FixtureDifficultyStrip } from '@/components/FixtureDifficultyStrip';
import { MarketValueSparkline } from '@/components/MarketValueSparkline';
import { MatchdayRow } from '@/components/MatchdayRow';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { StatusBadge } from '@/components/StatusBadge';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useExcludedFromSaleContext } from '@/lineup/ExcludedFromSaleContext';
import {
  useCompetitionTeams,
  useLeagueRanking,
  useLineup,
  useMarket,
  useMatchdays,
  usePlayer,
  usePlayerTransfers,
} from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget, withOrigin } from '@/shell/useBackTarget';
import { positionLabels } from '@/theme/tokens';
import { cx } from '@/utils/cx';
import {
  buildFixtureIndex,
  fixtureDifficulty,
  remainingFixtures,
  teamGoalRecord,
  teamStrength,
} from '@/utils/fixtureDifficulty';
import {
  formatCurrency,
  formatIsoDate,
  formatMinutes,
  formatPoints,
  formatPointsPerMinute,
} from '@/utils/format';
import { resolveLineupMatchday, resolveMatchdayState } from '@/utils/matchday';
import { resolvePlayerOwner, type PlayerOwnerInfo } from '@/utils/playerOwnership';
import { resolveOwnPurchase } from '@/utils/playerPurchase';
import { EMPTY_PLAYTIME, latestSeason, pointsPerMinute, sumPlaytime } from '@/utils/playtime';
import layout from '@/theme/layout.module.css';
import styles from './PlayerDetailScreen.module.css';

/** Wie viele kommende Spiele im "Nächste Gegner"-Streifen stehen — passend zur Standard-Ansicht des Restprogramm-Screens. */
const NEXT_OPPONENTS_COUNT = 5;

type Timeframe = 92 | 365;

export function PlayerDetailScreen() {
  const leagueId = useLeagueId();
  const { userId } = useAuth();
  const { playerId = '' } = useParams<{ playerId: string }>();
  const playerQuery = usePlayer(leagueId, playerId);
  const { data: player } = playerQuery;
  const [timeframe, setTimeframe] = useState<Timeframe>(92);
  const back = useBackTarget(leagueId);
  const { isExcluded, toggleExcluded } = useExcludedFromSaleContext();
  const excludedFromSale = isExcluded(playerId);

  const competitionId = useCompetitionId();
  const navigate = useNavigate();
  const { data: competitionTeams } = useCompetitionTeams(competitionId);
  const matchdaysQuery = useMatchdays(competitionId);

  // Besitzer-Quellen. Alle drei Queries gehören ohnehin zur App (Aufstellung,
  // Markt, Liga-Tab) und werden über ihren Key geteilt — nur ein Deep Link
  // direkt auf diesen Screen löst sie tatsächlich aus.
  const lineupQuery = useLineup(leagueId);
  const marketQuery = useMarket(leagueId);
  // Spieltagsbezogen wie in der Manager-Ansicht: die Startelfen der
  // Saisonwertung sind der Stand des zuletzt abgerechneten Spieltags und
  // könnten einen längst verkauften Spieler dem alten Besitzer zuschreiben.
  const lineupDay = matchdaysQuery.data
    ? (resolveLineupMatchday(
        resolveMatchdayState(matchdaysQuery.data, Date.now()),
        matchdaysQuery.data.currentDay,
      )?.day ?? null)
    : null;
  const rankingQuery = useLeagueRanking(leagueId, lineupDay ?? undefined, {
    enabled: lineupDay !== null,
  });

  // Solange eine Quelle noch lädt, ist „Besitzer unbekannt" verfrüht — das ist
  // eine Aussage über Kickbase, nicht über den Ladezustand.
  const ownerSourcesPending =
    !lineupQuery.data || !marketQuery.data || (lineupDay !== null && !rankingQuery.data);

  const owner = useMemo(
    () =>
      resolvePlayerOwner(playerId, {
        squadPlayerIds: (lineupQuery.data?.players ?? []).map((entry) => entry.id),
        marketListings: (marketQuery.data?.players ?? []).map((entry) => ({
          playerId: entry.id,
          sellerName: entry.sellerName,
          sellerId: entry.sellerId,
        })),
        managerLineups: (rankingQuery.data?.entries ?? []).map((entry) => ({
          userId: entry.userId,
          userName: entry.userName,
          lineupPlayerIds: entry.lineupPlayerIds,
        })),
      }),
    [playerId, lineupQuery.data, marketQuery.data, rankingQuery.data],
  );
  // Kaufdatum: nur für eigene Spieler geladen — bei fremden gäbe die
  // Transferhistorie für diesen Screen nichts her (siehe resolveOwnPurchase).
  const inOwnSquad = owner.kind === 'me';
  const transfersQuery = usePlayerTransfers(leagueId, playerId, { enabled: inOwnSquad });
  const purchase = useMemo(
    () =>
      resolveOwnPurchase({
        transfers: transfersQuery.data ?? [],
        ownUserId: userId,
        inOwnSquad,
      }),
    [transfersQuery.data, userId, inOwnSquad],
  );

  const refresh = useRefresh(
    playerQuery,
    matchdaysQuery,
    lineupQuery,
    marketQuery,
    rankingQuery,
    transfersQuery,
  );

  const teamNames = useMemo(
    () => new Map((competitionTeams ?? []).map((team) => [team.id, team.name])),
    [competitionTeams],
  );

  // "Nächste Gegner" — dieselbe Härte-Herleitung wie das Restprogramm
  // (src/screens/FixturesScreen.tsx), nur auf diesen einen Spieler und dessen
  // Position zugeschnitten. Ohne geladenen Spielplan bleibt es leer.
  const nextOpponentRatings = useMemo(() => {
    if (!player || !matchdaysQuery.data) return [];
    const schedule = matchdaysQuery.data;
    const fromDay =
      resolveMatchdayState(schedule, Date.now()).open?.day ?? schedule.currentDay ?? 1;
    const index = buildFixtureIndex(schedule);
    const strengths = teamStrength(teamGoalRecord(schedule));
    const upcoming = remainingFixtures(player.teamId, index, fromDay, NEXT_OPPONENTS_COUNT);
    return fixtureDifficulty(upcoming, strengths);
  }, [player, matchdaysQuery.data]);
  // Torwart/Abwehr: relevant ist die Angriffsgefahr der Gegner (defenseDifficulty).
  // Mittelfeld/Sturm: relevant ist deren Abwehrstärke (attackDifficulty). Siehe
  // positionDifficulty() in fixtureDifficulty.ts für dieselbe Zuordnung beim Optimizer.
  const nextOpponentLens =
    player && (player.position === 'GK' || player.position === 'DEF') ? 'defense' : 'attack';

  const header = <AppHeader title={player?.name ?? 'Spieler'} back={back} />;

  if (!player) {
    return (
      <>
        {header}
        <QueryState query={playerQuery} label="Spieler" refresh={refresh} />
      </>
    );
  }

  const history = timeframe === 92 ? player.marketValueHistory92 : player.marketValueHistory365;
  const season = latestSeason(player.performance);
  // Die Saison-Antwort enthält alle Spieltage inkl. Zukunft — nur bereits
  // ausgetragene anzeigen, sonst stünden dort lauter Phantom-0:0-Ergebnisse.
  const playedMatchdays = season
    ? [...season.matchdays].filter((md) => md.hasResult).reverse()
    : [];
  // Aus den Spieltagen summiert, nicht aus player.totalPoints/secondsPlayed:
  // die Detail-Antwort liefert `tp`/`sec` nicht verlässlich (siehe playtime.ts).
  const playtime = season ? sumPlaytime(season.matchdays) : EMPTY_PLAYTIME;

  function openManager(managerId: string) {
    navigate(
      `/${leagueId}/manager/${managerId}`,
      withOrigin(`/${leagueId}/player/${playerId}`, player!.name),
    );
  }

  return (
    <>
      {header}
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            <div className={styles.content}>
              <div className={styles.headerRow}>
                {player.imageUrl ? (
                  <img src={player.imageUrl} alt="" className={styles.image} />
                ) : (
                  <span className={cx(styles.image, styles.imageFallback)} />
                )}
                <div className={styles.headerInfo}>
                  <h2 className={styles.name}>{player.name}</h2>
                  <p className={styles.team}>{player.teamName || '—'}</p>
                  <div className={styles.badgeRow}>
                    <span className={styles.positionTag} data-position={player.position}>
                      {positionLabels[player.position]}
                    </span>
                    <StatusBadge status={player.status} />
                  </div>
                  {player.statusDetails.length > 0 && (
                    <p className={styles.statusDetails}>{player.statusDetails.join(' · ')}</p>
                  )}
                  <OwnerLine
                    owner={owner}
                    pending={ownerSourcesPending}
                    onOpenManager={owner.userId ? () => openManager(owner.userId!) : undefined}
                  />
                  {inOwnSquad && (
                    <PurchaseLine purchase={purchase} pending={transfersQuery.isPending} />
                  )}
                </div>
              </div>

              <dl className={styles.statsGrid}>
                <Stat label="Marktwert" value={formatCurrency(player.marketValue)} />
                <Stat label="Punkte gesamt" value={formatPoints(player.totalPoints)} />
                <Stat label="Ø Punkte" value={formatPoints(player.averagePoints)} />
                <Stat label="Tore" value={String(player.goals)} />
                <Stat label="Assists" value={String(player.assists)} />
                <Stat label="Gelb / Rot" value={`${player.yellowCards} / ${player.redCards}`} />
                <Stat label="Spielzeit" value={formatMinutes(playtime.minutes)} />
                <Stat
                  label="Punkte/Min"
                  value={
                    playtime.minutes > 0
                      ? formatPointsPerMinute(pointsPerMinute(playtime.points, playtime.minutes))
                      : '—'
                  }
                />
              </dl>

              {/*
               * Nur für eigene Kaderspieler sinnvoll — bei fremden Spielern gibt
               * es nichts zu verkaufen. Ein bereits gesetzter Ausschluss bleibt
               * aber immer sichtbar, sonst ließe er sich nach einem
               * Besitzerwechsel nicht mehr aufheben.
               */}
              {(inOwnSquad || excludedFromSale) && (
                <div className={styles.excludeCard}>
                  <Checkbox
                    label="Vom Verkauf ausschließen"
                    checked={excludedFromSale}
                    onChange={() => toggleExcluded(playerId)}
                    hint="Der Verkaufsvorschlag schlägt ihn nicht mehr vor, und der Kontoausgleich plant ihn nicht ein. Die Aufstellungs-Optimierung bleibt unberührt."
                  />
                </div>
              )}

              {nextOpponentRatings.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Nächste Gegner</h3>
                  <FixtureDifficultyStrip
                    ratings={nextOpponentRatings}
                    lens={nextOpponentLens}
                    size={44}
                    showOpponentLogos
                  />
                </section>
              )}

              <section className={styles.section}>
                <div className={styles.sectionHeaderRow}>
                  <h3 className={styles.sectionTitle}>Marktwertverlauf</h3>
                  <div className={styles.timeframeToggle} role="group" aria-label="Zeitraum">
                    {([92, 365] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        aria-pressed={timeframe === tf}
                        className={cx(layout.pressable, styles.timeframeChip)}
                        onClick={() => setTimeframe(tf)}
                      >
                        {tf === 92 ? '3 Monate' : '1 Jahr'}
                      </button>
                    ))}
                  </div>
                </div>
                <MarketValueSparkline points={history.points} />
                <div className={styles.minMaxRow}>
                  <span className={styles.minMaxText}>Tief {formatCurrency(history.lowest)}</span>
                  <span className={styles.minMaxText}>Hoch {formatCurrency(history.highest)}</span>
                </div>
              </section>

              {season && playedMatchdays.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle}>Spieltage {season.title}</h3>
                    <span className={styles.legend}>H = Heim · A = Auswärts</span>
                  </div>
                  {playedMatchdays.map((md) => (
                    <MatchdayRow
                      key={md.matchday}
                      matchday={md}
                      playerTeamId={player.teamId}
                      teamNames={teamNames}
                    />
                  ))}
                </section>
              )}
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

/** Zahl über Bezeichnung — als dt/dd-Paar, damit die Zuordnung nicht nur optisch ist. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dd className={styles.statValue}>{value}</dd>
      <dt className={styles.statLabel}>{label}</dt>
    </div>
  );
}

/**
 * "Gekauft am 12.08.2026" — wann der Spieler in den eigenen Kader gewechselt
 * ist, aus seiner Transferhistorie abgeleitet (siehe resolveOwnPurchase).
 * Steht nur bei eigenen Spielern.
 *
 * Ohne belegbaren Kauf bleibt die Zeile WEG statt „unbekannt" anzuzeigen:
 * Kickbase führt nicht zu jedem Spieler eine Transferhistorie (ein von Beginn
 * an gehaltener Spieler hat schlicht keine), und ein Zusatzrequest, der
 * ausfällt, soll auf dem Screen keine Fehlermeldung hinterlassen.
 */
function PurchaseLine({ purchase, pending }: { purchase: PlayerTransfer | null; pending: boolean }) {
  if (pending) {
    return <p className={cx(styles.purchase, styles.purchasePending)}>Gekauft …</p>;
  }
  const date = purchase ? formatIsoDate(purchase.date) : null;
  if (!date) return null;
  return <p className={styles.purchase}>Gekauft am {date}</p>;
}

/**
 * Wem der Spieler gehört. „Besitzer unbekannt" ist hier eine echte Aussage und
 * kein Fehler: Kickbase legt von fremden Managern nur die Startelf offen, ein
 * Bankspieler eines Rivalen ist von einem ungekauften Spieler nicht zu
 * unterscheiden (siehe resolvePlayerOwner). Deshalb steht dort auch nie
 * „frei" — nur beim Kickbase-Angebot ist belegt, dass ihn kein Manager hat.
 */
function OwnerLine({
  owner,
  pending,
  onOpenManager,
}: {
  owner: PlayerOwnerInfo;
  /** Eine der Besitzer-Quellen lädt noch — dann ist „unbekannt" noch keine Antwort. */
  pending: boolean;
  onOpenManager?: () => void;
}) {
  if (owner.kind === 'unknown' && pending) {
    return <p className={cx(styles.owner, styles.ownerUnknown)}>Besitzer …</p>;
  }

  const label =
    owner.kind === 'me'
      ? 'In deinem Kader'
      : owner.kind === 'manager'
        ? `Kader von ${owner.name ?? 'einem Manager'}`
        : owner.kind === 'free'
          ? 'Kein Manager · Kickbase-Angebot'
          : 'Besitzer unbekannt';

  const text = `${label}${owner.onMarket ? ' · am Markt' : ''}`;

  // Nur antippbar, wenn wir eine User-ID haben — ein toter Druckbereich wäre
  // schlechter als reiner Text.
  if (!onOpenManager) {
    return (
      <p className={cx(styles.owner, owner.kind === 'unknown' && styles.ownerUnknown)}>{text}</p>
    );
  }

  return (
    <button
      type="button"
      className={cx(layout.pressable, styles.owner, styles.ownerButton)}
      onClick={onOpenManager}
    >
      {text}
      {/* Das Chevron war vorher Teil des Textes und wurde mitgelesen. */}
      <span aria-hidden="true"> ›</span>
    </button>
  );
}

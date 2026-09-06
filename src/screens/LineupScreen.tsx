import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { LeagueSwitcher } from '@/components/LeagueSwitcher';
import { MarketListingModal } from '@/components/MarketListingModal';
import { OptimizerBar } from '@/components/OptimizerBar';
import { Pitch } from '@/components/Pitch';
import { PlayerCard } from '@/components/PlayerCard';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SellAdviceSection } from '@/components/SellAdviceSection';
import { SellPlanBar } from '@/components/SellPlanBar';
import { Spinner } from '@/components/Spinner';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useExcludedFromSaleContext } from '@/lineup/ExcludedFromSaleContext';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { useLineupDraftContext } from '@/lineup/LineupDraftContext';
import { useLineupOptimizer } from '@/lineup/useLineupOptimizer';
import {
  useLeagues,
  useLineup,
  useMarket,
  useMatchdays,
  usePurchases,
  useSaveLineup,
} from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { withOrigin } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import type { AverageDifficulty } from '@/utils/fixtureDifficulty';
import {
  averageDifficulty,
  buildFixtureIndex,
  fixtureDifficulty,
  remainingFixtures,
  teamGoalRecord,
  teamStrength,
} from '@/utils/fixtureDifficulty';
import {
  formatCountdown,
  formatCurrency,
  formatPoints,
  formatValueScore,
  msUntil,
} from '@/utils/format';
import {
  AVAILABLE_FORMATIONS,
  formationFor,
  orderIdsByPosition,
  requiredCountsForFormation,
} from '@/utils/formations';
import { compareByMetric } from '@/utils/lineupOptimizer';
import { resolveMatchdayState } from '@/utils/matchday';
import layout from '@/theme/layout.module.css';
import styles from './LineupScreen.module.css';

/** Wie viele kommende Spieltage in die 'expectedPoints'-Metrik einfließen (siehe fixtureDifficulty.ts). */
const FIXTURE_LOOKAHEAD = 5;

export function LineupScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const navigate = useNavigate();
  const lineupQuery = useLineup(leagueId);
  const { data } = lineupQuery;
  const matchdaysQuery = useMatchdays(competitionId);
  const leaguesQuery = useLeagues();
  // Dieselbe Query, die useBudgetLimit unten ohnehin mountet — React Query
  // dedupliziert über den Key, kein zusätzlicher Request beim Pull.
  const marketQuery = useMarket(leagueId);
  const refresh = useRefresh(lineupQuery, matchdaysQuery, leaguesQuery, marketQuery);
  // Budget lebt in LeagueSummary (`/v4/leagues/selection`), NICHT in
  // LineupData — `lineup/overview.b` ist trotz Namens keine Kontostandsgröße,
  // siehe toLineupData() in mappers.ts.
  const league = useCurrentLeague();
  const budgetLimit = useBudgetLimit();
  const saveLineup = useSaveLineup(leagueId);
  const { rules } = useLeagueRulesContext();
  const { excludedIds, toggleExcluded } = useExcludedFromSaleContext();
  const [, forceTick] = useState(0);

  // Die Bearbeitungs-Sitzung liegt im LineupDraftProvider (LeagueLayout), nicht
  // hier: die „Regeln"-Zeile der OptimizerBar und jede Spielerkarte navigieren
  // weg und hängen diesen Screen aus. Mit lokalem useState kam man in einen
  // zugeklappten Optimizer und ohne Entwurf zurück — siehe LineupDraftContext.
  const {
    editing,
    setEditing,
    formation,
    setFormation,
    draftIds,
    setDraftIds,
    selectedBenchId,
    setSelectedBenchId,
    appliedDiff,
    setAppliedDiff,
    preOptimize,
    setPreOptimize,
    autoNote,
    setAutoNote,
  } = useLineupDraftContext();
  // „Auf den Markt stellen" für die Pflichtverkäufe — der Dialog hängt an der
  // Kaufen/Verkaufen-Sektion und damit bewusst NICHT am Edit-Modus: das Konto
  // will auch nach der Aufstellungs-Deadline ausgeglichen werden.
  const [listingOpen, setListingOpen] = useState(false);
  // Ob die Kaufen/Verkaufen-Sektion aufgeklappt ist. Hängt hier und nicht nur
  // dort, weil daran die Kaufpreis-Requests hängen: einer PRO Kaderspieler
  // (siehe usePurchases), also erst holen, wenn die Liste wirklich offen ist.
  const [sellAdviceOpen, setSellAdviceOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Kaufpreise für die Kaufen/Verkaufen-Liste — ein Request PRO Kaderspieler
  // (siehe usePurchases), deshalb erst wenn die Liste aufgeklappt ist.
  // `useMemo` auf die ID-Liste ist Pflicht: useQueries baut sonst bei jedem
  // Render eine neue Query-Liste auf.
  const squadPlayerIds = useMemo(() => (data?.players ?? []).map((p) => p.id), [data]);
  const purchases = usePurchases(leagueId, squadPlayerIds, { enabled: sellAdviceOpen });
  // Die Sektion braucht nur den Preis, nicht den ganzen Transfer.
  const purchasePrices = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const [playerId, transfer] of purchases.purchases) map.set(playerId, transfer.price);
    return map;
  }, [purchases.purchases]);
  // Countdown-Anzeige lebendig halten, ohne dafür zu pollen (kein Netzwerk-Request).
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Spielplan der Competition ist die verlässliche Quelle für "welcher
  // Spieltag läuft/ist offen" — mdln/lis auf lineup/overview hängen
  // erfahrungsgemäß hinterher (siehe utils/matchday.ts). Fällt die Query
  // aus, degradieren wir auf die alte lis-basierte Deadline.
  const matchdayState = useMemo(() => {
    if (!matchdaysQuery.data) return null;
    return resolveMatchdayState(matchdaysQuery.data, Date.now());
  }, [matchdaysQuery.data]);

  // Gegner-Härte je Verein für die 'expectedPoints'-Metrik (siehe
  // src/utils/fixtureDifficulty.ts), gemittelt über die nächsten
  // FIXTURE_LOOKAHEAD Spieltage ab dem nächsten noch offenen. Ohne Spielplan
  // (Query lädt noch) bleibt die Map undefined — useLineupOptimizer
  // degradiert dann sauber auf reine Ø-Punkte.
  const fixtureDifficultyByTeam = useMemo(() => {
    if (!matchdaysQuery.data || !data) return undefined;
    const fromDay = matchdayState?.open?.day ?? matchdaysQuery.data.currentDay ?? 1;
    const index = buildFixtureIndex(matchdaysQuery.data);
    const strengths = teamStrength(teamGoalRecord(matchdaysQuery.data));
    const teamIds = new Set(data.players.map((p) => p.teamId));
    const map = new Map<string, AverageDifficulty>();
    for (const teamId of teamIds) {
      const upcoming = remainingFixtures(teamId, index, fromDay, FIXTURE_LOOKAHEAD);
      map.set(teamId, averageDifficulty(fixtureDifficulty(upcoming, strengths)));
    }
    return map;
  }, [matchdaysQuery.data, data, matchdayState]);

  const optimizer = useLineupOptimizer(
    data?.players ?? [],
    draftIds,
    budgetLimit?.deficit ?? 0,
    rules,
    fixtureDifficultyByTeam,
    excludedIds,
  );

  const fallbackDeadlineMs = data ? msUntil(data.lineupDeadline) : null;
  const openDeadlineMs = matchdayState
    ? matchdayState.open
      ? msUntil(matchdayState.open.deadline)
      : null
    : fallbackDeadlineMs;
  const hasOpenMatchday = matchdayState
    ? matchdayState.open !== null
    : openDeadlineMs !== null && openDeadlineMs > 0;
  const displayMatchday =
    matchdayState?.running?.day ?? matchdayState?.open?.day ?? data?.matchday ?? null;

  function startEditing() {
    if (!data) return;
    setFormation(data.formation);
    setDraftIds(data.players.filter((p) => p.inLineup).map((p) => p.id));
    setSelectedBenchId(null);
    setSaveError(null);
    setAppliedDiff(null);
    setPreOptimize(null);
    setAutoNote(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSelectedBenchId(null);
    setSaveError(null);
    setAppliedDiff(null);
    setPreOptimize(null);
    setAutoNote(null);
  }

  /**
   * Veraltete Marker verwerfen — jeder manuelle Eingriff macht den
   * eingefrorenen Optimizer-Diff und die letzte Formations-Rückmeldung ungültig.
   */
  function clearEditMarkers() {
    setAppliedDiff(null);
    setPreOptimize(null);
    setAutoNote(null);
  }

  function applyOptimization() {
    const best = optimizer.result.best;
    if (!best) return;
    setAutoNote(null);
    setPreOptimize({ formation, draftIds });
    setAppliedDiff(optimizer.preview);
    setFormation(best.formation);
    setDraftIds(best.playerIds);
    setSelectedBenchId(null);
  }

  function resetOptimization() {
    if (!preOptimize) return;
    setFormation(preOptimize.formation);
    setDraftIds(preOptimize.draftIds);
    setSelectedBenchId(null);
    setAppliedDiff(null);
    setPreOptimize(null);
    setAutoNote(null);
  }

  const playersById = useMemo(() => {
    const map = new Map<string, SquadPlayer>();
    data?.players.forEach((p) => map.set(p.id, p));
    return map;
  }, [data]);

  const required = requiredCountsForFormation(formation);
  const countByPosition = useMemo(() => {
    const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const id of draftIds) {
      const p = playersById.get(id);
      if (p) counts[p.position]++;
    }
    return counts;
  }, [draftIds, playersById]);

  /** Positionsverteilung des Entwurfs nach einem geplanten Zu-/Abgang. */
  function countsAfter({
    add,
    remove,
  }: {
    add?: Position;
    remove?: Position;
  }): Record<Position, number> {
    const next = { ...countByPosition };
    if (remove) next[remove]--;
    if (add) next[add]++;
    return next;
  }

  /** Bewertung der Formations-Chips als Tiebreak für die automatische Erkennung. */
  function formationScore(f: string): number | null {
    return optimizer.scoreByFormation.get(f) ?? null;
  }

  /** Formation, in der die Verteilung unterkommt — null, wenn es keine gibt. */
  function detectFormation(counts: Record<Position, number>): string | null {
    return formationFor(counts, { current: formation, score: formationScore });
  }

  function changeFormation(next: string) {
    clearEditMarkers();
    const nextRequired = requiredCountsForFormation(next);
    setDraftIds((current) => {
      const byPosition: Record<Position, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
      for (const id of current) {
        const p = playersById.get(id);
        if (p) byPosition[p.position].push(p);
      }
      const kept: string[] = [];
      const comparator = compareByMetric(optimizer.metric);
      (Object.keys(byPosition) as Position[]).forEach((pos) => {
        const target = nextRequired[pos];
        const sorted = [...byPosition[pos]].sort(comparator);
        kept.push(...sorted.slice(0, target).map((p) => p.id));
      });
      return kept;
    });
    setFormation(next);
    setSelectedBenchId(null);
  }

  function tapPitchPlayer(player: SquadPlayer) {
    if (!editing) {
      openPlayer(player);
      return;
    }
    clearEditMarkers();
    if (selectedBenchId) {
      const benchPlayer = playersById.get(selectedBenchId);
      if (!benchPlayer) return;
      const swap = () => {
        setDraftIds((current) => current.filter((id) => id !== player.id).concat(benchPlayer.id));
        setSelectedBenchId(null);
      };
      if (benchPlayer.position === player.position) {
        swap();
        return;
      }
      // Positionsübergreifender Tausch — erlaubt, solange die Elf danach in
      // irgendeine Formation passt. Bei voller Elf ist das der einzige Weg,
      // das System überhaupt zu wechseln, ohne vorher Spieler abzuräumen.
      const next = detectFormation(
        countsAfter({ add: benchPlayer.position, remove: player.position }),
      );
      if (!next) {
        setAutoNote('Kein passendes System für diesen Tausch.');
        return;
      }
      swap();
      applyDetectedFormation(next);
      return;
    }
    setDraftIds((current) => current.filter((id) => id !== player.id));
  }

  function tapBenchPlayer(player: SquadPlayer) {
    if (!editing) {
      openPlayer(player);
      return;
    }
    clearEditMarkers();
    if (countByPosition[player.position] < required[player.position]) {
      setDraftIds((current) => current.concat(player.id));
      setSelectedBenchId(null);
      return;
    }
    // Position in der aktuellen Formation voll — statt nur einen Tausch
    // anzubieten, die Formation mitziehen, wenn eine passt. Bewusst nicht über
    // changeFormation(): dessen Pruning würde den Entwurf beschneiden, obwohl
    // hier per Konstruktion jeder Spieler unterkommt.
    const next = detectFormation(countsAfter({ add: player.position }));
    if (next) {
      setDraftIds((current) => current.concat(player.id));
      setSelectedBenchId(null);
      applyDetectedFormation(next);
      return;
    }
    setSelectedBenchId((current) => (current === player.id ? null : player.id));
  }

  function applyDetectedFormation(next: string) {
    if (next === formation) return;
    setFormation(next);
    setAutoNote(`Formation auf ${next} angepasst.`);
  }

  async function handleSave() {
    setSaveError(null);
    if (!hasOpenMatchday) {
      setSaveError('Deadline abgelaufen.');
      return;
    }
    try {
      const orderedIds = orderIdsByPosition(draftIds, (id) => playersById.get(id)?.position);
      await saveLineup.mutateAsync({ formation, playerIds: orderedIds });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    }
  }

  const origin = withOrigin(`/${leagueId}/lineup`, leagueTabTitles.lineup);

  function openPlayer(player: SquadPlayer) {
    navigate(`/${leagueId}/player/${player.id}`, origin);
  }

  const header = <AppHeader title={<LeagueSwitcher />} />;

  if (!data) {
    return (
      <>
        {header}
        <QueryState query={lineupQuery} label="Aufstellung" refresh={refresh} />
      </>
    );
  }

  const lineupPlayers = editing
    ? draftIds.map((id) => playersById.get(id)).filter((p): p is SquadPlayer => !!p)
    : data.players.filter((p) => p.inLineup);
  const bench = editing
    ? data.players.filter((p) => !draftIds.includes(p.id))
    : data.players.filter((p) => !p.inLineup);

  const totalRequired = required.GK + required.DEF + required.MID + required.FWD;
  const canSave = draftIds.length === totalRequired && !saveLineup.isPending;

  return (
    <>
      {header}
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            <div className={styles.content}>
              <div className={styles.matchdayHeader}>
                <div className={styles.headerColumn}>
                  <span className={styles.headerLabel}>
                    {displayMatchday !== null ? `Spieltag ${displayMatchday}` : 'Spieltag —'}
                  </span>
                  {matchdayState?.running ? (
                    <span className={styles.headerSub}>läuft · gesperrt</span>
                  ) : openDeadlineMs !== null ? (
                    <span className={styles.headerSub}>
                      {openDeadlineMs <= 0
                        ? 'Aufstellung gesperrt'
                        : `Deadline in ${formatCountdown(openDeadlineMs)}`}
                    </span>
                  ) : (
                    !hasOpenMatchday && (
                      <span className={styles.headerSub}>Aufstellung gesperrt</span>
                    )
                  )}
                  {matchdayState?.running && matchdayState.open && (
                    <span className={styles.headerSub}>
                      Spieltag {matchdayState.open.day}
                      {openDeadlineMs !== null &&
                        ` · Deadline in ${formatCountdown(openDeadlineMs)}`}
                    </span>
                  )}
                </div>
                <div className={styles.headerStats}>
                  <span className={styles.headerLabel}>{formatCurrency(data.teamValue)}</span>
                  {league && (
                    <span
                      className={cx(
                        styles.headerSub,
                        league.budget < 0 && styles.headerSubNegative,
                      )}
                    >
                      Budget {formatCurrency(league.budget)}
                    </span>
                  )}
                  {budgetLimit && (
                    <span className={styles.headerSub}>
                      Verfügbar {formatCurrency(budgetLimit.available)}
                    </span>
                  )}
                </div>
              </div>

              {/*
               * Ein `<Link>` und kein Button: das ist eine Navigation, und ein
               * echtes `<a href>` erlaubt „in neuem Tab öffnen" und zeigt das
               * Ziel in der Statusleiste. Die Herkunft geht als state mit,
               * damit Zurück von dort hierher führt.
               */}
              <Link to={`/${leagueId}/fixtures`} state={origin.state} className={styles.navRow}>
                <span className={styles.navRowText}>Restprogramm</span>
                <span className={styles.navRowChevron} aria-hidden="true">
                  ›
                </span>
              </Link>

              {hasOpenMatchday && (
                <button
                  type="button"
                  className={cx(layout.pressable, styles.editToggle)}
                  onClick={editing ? cancelEditing : startEditing}
                  aria-pressed={editing}
                >
                  {editing ? 'Abbrechen' : 'Aufstellung bearbeiten'}
                </button>
              )}

              {editing && (
                <OptimizerBar
                  metric={optimizer.metric}
                  onChangeMetric={optimizer.setMetric}
                  result={optimizer.result}
                  appliedDiff={appliedDiff}
                  onApply={applyOptimization}
                  onReset={resetOptimization}
                  balanceBudget={optimizer.balanceBudget}
                  onChangeBalanceBudget={optimizer.setBalanceBudget}
                  deficit={budgetLimit?.deficit ?? 0}
                  rules={optimizer.rules}
                  onOpenRules={() => navigate(`/${leagueId}/rules`, origin)}
                  onIgnoreRule={optimizer.ignoreRule}
                  draftViolations={optimizer.draftViolations}
                />
              )}

              {editing && (
                <SellPlanBar
                  players={data.players}
                  plan={optimizer.sellPlan}
                  metric={optimizer.metric}
                />
              )}

              {editing && (
                <div className={styles.formationRow} role="group" aria-label="Formation">
                  {AVAILABLE_FORMATIONS.map((f) => {
                    const score = optimizer.scoreByFormation.get(f) ?? null;
                    const isBest = optimizer.result.best?.formation === f;
                    const isFeasible =
                      optimizer.result.ranking.find((r) => r.formation === f)?.feasible ?? true;
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={formation === f}
                        // Nicht besetzbar heißt blass, aber nicht gesperrt:
                        // ein Wechsel dorthin ist erlaubt und beschneidet den
                        // Entwurf (siehe changeFormation).
                        data-infeasible={!isFeasible || undefined}
                        className={cx(layout.pressableV, styles.formationChip)}
                        onClick={() => changeFormation(f)}
                      >
                        <span className={styles.formationChipText}>
                          {isBest ? `★ ${f}` : f}
                        </span>
                        <span
                          className={cx(
                            styles.formationChipScore,
                            isBest && styles.formationChipScoreBest,
                          )}
                        >
                          {score === null
                            ? '—'
                            : optimizer.metric === 'valuePerMillion'
                              ? formatValueScore(score)
                              : formatPoints(Math.round(score))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!editing && <p className={styles.formation}>{data.formation || '—'}</p>}

              <Pitch
                players={lineupPlayers}
                onSelectPlayer={tapPitchPlayer}
                changedIds={editing ? appliedDiff?.addedIds : undefined}
              />

              {editing && (
                <p className={styles.hint}>
                  {autoNote
                    ? autoNote
                    : selectedBenchId
                      ? 'Spieler auf dem Feld antippen, um zu tauschen — die Formation passt sich an.'
                      : 'Startelf-Spieler antippen entfernt ihn auf die Bank. Bankspieler antippen füllt eine freie Position oder passt die Formation an.'}
                </p>
              )}

              <h2 className={styles.sectionTitle}>Bank ({bench.length})</h2>
              <div className={styles.bench}>
                {bench.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onClick={tapBenchPlayer}
                    highlighted={editing && selectedBenchId === player.id}
                    changed={editing && appliedDiff?.removedIds.has(player.id)}
                  />
                ))}
              </div>

              <SellAdviceSection
                players={data.players}
                advice={optimizer.sellAdvice}
                plan={optimizer.budgetPlan}
                budget={league?.budget ?? null}
                onSelectPlayer={openPlayer}
                onToggleExcluded={(player) => toggleExcluded(player.id)}
                onListOnMarket={() => setListingOpen(true)}
                purchases={purchasePrices}
                purchasesPending={purchases.pending}
                onExpandedChange={setSellAdviceOpen}
              />

              {/* Portal nach document.body (siehe Modal.tsx) — liegt hier nur
                  im Baum, nicht im Refreshable-Wisch. */}
              <MarketListingModal
                open={listingOpen}
                onClose={() => setListingOpen(false)}
                players={data.players}
                plan={optimizer.budgetPlan}
                budget={league?.budget ?? 0}
              />

              {editing && (
                <div className={styles.saveBar}>
                  {saveError && (
                    <p className={styles.errorText} role="alert">
                      {saveError}
                    </p>
                  )}
                  {draftIds.length !== totalRequired && (
                    <p className={styles.hint}>
                      {draftIds.length} von {totalRequired} Positionen besetzt.
                    </p>
                  )}
                  <button
                    type="button"
                    className={cx(layout.pressableH, styles.saveButton)}
                    onClick={handleSave}
                    disabled={!canSave}
                  >
                    {saveLineup.isPending ? <Spinner color="currentColor" /> : 'Speichern'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

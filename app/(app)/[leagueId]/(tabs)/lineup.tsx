import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { OptimizerBar } from '@/components/OptimizerBar';
import { Pitch } from '@/components/Pitch';
import { PlayerCard } from '@/components/PlayerCard';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { SellAdviceSection } from '@/components/SellAdviceSection';
import { SellPlanBar } from '@/components/SellPlanBar';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useExcludedFromSaleContext } from '@/lineup/ExcludedFromSaleContext';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { type OptimizerDiff, useLineupOptimizer } from '@/lineup/useLineupOptimizer';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
import { useLeagues, useLineup, useMarket, useMatchdays, useSaveLineup } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';
import { formatCountdown, formatCurrency, formatPoints, formatValueScore, msUntil } from '@/utils/format';
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
  AVAILABLE_FORMATIONS,
  formationFor,
  orderIdsByPosition,
  requiredCountsForFormation,
} from '@/utils/formations';
import { compareByMetric } from '@/utils/lineupOptimizer';
import { resolveMatchdayState } from '@/utils/matchday';

/** Wie viele kommende Spieltage in die 'expectedPoints'-Metrik einfließen (siehe fixtureDifficulty.ts). */
const FIXTURE_LOOKAHEAD = 5;

export default function LineupScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const router = useRouter();
  const lineupQuery = useLineup(leagueId);
  const { data } = lineupQuery;
  useMarkInteractive(!!data);
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

  const [editing, setEditing] = useState(false);
  const [formation, setFormation] = useState<string>('');
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Rückmeldung zur automatischen Formationserkennung — lebt nur bis zum
  // nächsten Eingriff und ersetzt solange die Hinweiszeile unter dem Feld.
  const [autoNote, setAutoNote] = useState<string | null>(null);

  // Eingefroren zum Zeitpunkt des letzten "Optimieren" — treibt Marker/Diff-Anzeige,
  // unabhängig vom aktuellen (nach dem Übernehmen wieder leeren) Live-Diff.
  const [appliedDiff, setAppliedDiff] = useState<OptimizerDiff | null>(null);
  const [preOptimize, setPreOptimize] = useState<{ formation: string; draftIds: string[] } | null>(null);

  // Countdown-Anzeige lebendig halten, ohne dafür zu pollen (kein Netzwerk-Request).
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
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
  const hasOpenMatchday = matchdayState ? matchdayState.open !== null : openDeadlineMs !== null && openDeadlineMs > 0;
  const displayMatchday = matchdayState?.running?.day ?? matchdayState?.open?.day ?? data?.matchday ?? null;

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
  function countsAfter({ add, remove }: { add?: Position; remove?: Position }): Record<Position, number> {
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
      const next = detectFormation(countsAfter({ add: benchPlayer.position, remove: player.position }));
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

  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  function openRules() {
    router.push({ pathname: '/[leagueId]/rules', params: { leagueId } });
  }

  function openFixtures() {
    router.push({ pathname: '/[leagueId]/fixtures', params: { leagueId } });
  }

  if (!data) {
    return <QueryState query={lineupQuery} label="Aufstellung" refresh={refresh} />;
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
    <Refreshable {...refresh}>
      {(p) => (
        <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>
            {displayMatchday !== null ? `Spieltag ${displayMatchday}` : 'Spieltag —'}
          </Text>
          {matchdayState?.running ? (
            <Text style={styles.headerSub}>läuft · gesperrt</Text>
          ) : openDeadlineMs !== null ? (
            <Text style={styles.headerSub}>
              {openDeadlineMs <= 0 ? 'Aufstellung gesperrt' : `Deadline in ${formatCountdown(openDeadlineMs)}`}
            </Text>
          ) : (
            !hasOpenMatchday && <Text style={styles.headerSub}>Aufstellung gesperrt</Text>
          )}
          {matchdayState?.running && matchdayState.open && (
            <Text style={styles.headerSub}>
              Spieltag {matchdayState.open.day}
              {openDeadlineMs !== null && ` · Deadline in ${formatCountdown(openDeadlineMs)}`}
            </Text>
          )}
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.headerLabel}>{formatCurrency(data.teamValue)}</Text>
          {league && (
            <Text style={[styles.headerSub, league.budget < 0 && styles.headerSubNegative]}>
              Budget {formatCurrency(league.budget)}
            </Text>
          )}
          {budgetLimit && <Text style={styles.headerSub}>Verfügbar {formatCurrency(budgetLimit.available)}</Text>}
        </View>
      </View>

      <Pressable style={styles.fixturesLink} onPress={openFixtures}>
        <Text style={styles.fixturesLinkText}>Restprogramm</Text>
        <Text style={styles.fixturesLinkChevron}>›</Text>
      </Pressable>

      {hasOpenMatchday && (
        <Pressable
          style={styles.editToggle}
          onPress={editing ? cancelEditing : startEditing}
        >
          <Text style={styles.editToggleText}>
            {editing ? 'Abbrechen' : 'Aufstellung bearbeiten'}
          </Text>
        </Pressable>
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
          onOpenRules={openRules}
          onIgnoreRule={optimizer.ignoreRule}
          draftViolations={optimizer.draftViolations}
        />
      )}

      {editing && <SellPlanBar players={data.players} plan={optimizer.sellPlan} metric={optimizer.metric} />}

      {editing && (
        <View style={styles.formationRow}>
          {AVAILABLE_FORMATIONS.map((f) => {
            const score = optimizer.scoreByFormation.get(f) ?? null;
            const isBest = optimizer.result.best?.formation === f;
            const isFeasible = optimizer.result.ranking.find((r) => r.formation === f)?.feasible ?? true;
            return (
              <Pressable
                key={f}
                style={[
                  styles.formationChip,
                  formation === f && styles.formationChipActive,
                  !isFeasible && styles.formationChipInfeasible,
                ]}
                onPress={() => changeFormation(f)}
              >
                <Text style={[styles.formationChipText, formation === f && styles.formationChipTextActive]}>
                  {isBest ? `★ ${f}` : f}
                </Text>
                <Text style={[styles.formationChipScore, isBest && styles.formationChipScoreBest]}>
                  {score === null
                    ? '—'
                    : optimizer.metric === 'valuePerMillion'
                      ? formatValueScore(score)
                      : formatPoints(Math.round(score))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!editing && <Text style={styles.formation}>{data.formation || '—'}</Text>}

      <Pitch players={lineupPlayers} onSelectPlayer={tapPitchPlayer} changedIds={editing ? appliedDiff?.addedIds : undefined} />

      {editing && (
        <Text style={styles.hint}>
          {autoNote
            ? autoNote
            : selectedBenchId
              ? 'Spieler auf dem Feld antippen, um zu tauschen — die Formation passt sich an.'
              : 'Startelf-Spieler antippen entfernt ihn auf die Bank. Bankspieler antippen füllt eine freie Position oder passt die Formation an.'}
        </Text>
      )}

      <Text style={styles.sectionTitle}>Bank ({bench.length})</Text>
      <View style={styles.bench}>
        {bench.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onPress={tapBenchPlayer}
            highlighted={editing && selectedBenchId === player.id}
            changed={editing && appliedDiff?.removedIds.has(player.id)}
          />
        ))}
      </View>

      <SellAdviceSection
        players={data.players}
        advice={optimizer.sellAdvice}
        plan={optimizer.budgetPlan}
        budget={league?.budget ?? null}
        onSelectPlayer={openPlayer}
        onToggleExcluded={(player) => toggleExcluded(player.id)}
      />

      {editing && (
        <View style={styles.saveBar}>
          {saveError && <Text style={styles.errorText}>{saveError}</Text>}
          {draftIds.length !== totalRequired && (
            <Text style={styles.hint}>
              {draftIds.length} von {totalRequired} Positionen besetzt.
            </Text>
          )}
          <Pressable
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {saveLineup.isPending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Speichern</Text>
            )}
          </Pressable>
        </View>
      )}
        </ScrollView>
      )}
    </Refreshable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerSubNegative: {
    color: colors.danger,
    fontWeight: '600',
  },
  formation: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fixturesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
  },
  fixturesLinkText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fixturesLinkChevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
  editToggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editToggleText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  formationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  formationChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  formationChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  formationChipInfeasible: {
    opacity: 0.45,
  },
  formationChipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  formationChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  formationChipScore: {
    ...typography.small,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  formationChipScoreBest: {
    color: colors.accent,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  bench: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  saveBar: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.heading,
    color: colors.background,
  },
});

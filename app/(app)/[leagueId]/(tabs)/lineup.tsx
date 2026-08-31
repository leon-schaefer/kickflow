import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import { SellAdviceSection } from '@/components/SellAdviceSection';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { type OptimizerDiff, useLineupOptimizer } from '@/lineup/useLineupOptimizer';
import { useLeagues, useLineup, useMatchdays, useSaveLineup } from '@/queries/hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCountdown, formatCurrency, formatPoints, formatValueScore, msUntil } from '@/utils/format';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from '@/utils/formations';
import { compareByMetric } from '@/utils/lineupOptimizer';
import { resolveMatchdayState } from '@/utils/matchday';

export default function LineupScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const router = useRouter();
  const lineupQuery = useLineup(leagueId);
  const { data, refetch, isRefetching } = lineupQuery;
  const matchdaysQuery = useMatchdays(competitionId);
  const leaguesQuery = useLeagues();
  // Budget lebt in LeagueSummary (`/v4/leagues/selection`), NICHT in
  // LineupData — `lineup/overview.b` ist trotz Namens keine Kontostandsgröße,
  // siehe toLineupData() in mappers.ts.
  const league = useCurrentLeague();
  const saveLineup = useSaveLineup(leagueId);
  const [, forceTick] = useState(0);

  const [editing, setEditing] = useState(false);
  const [formation, setFormation] = useState<string>('');
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Eingefroren zum Zeitpunkt des letzten "Optimieren" — treibt Marker/Diff-Anzeige,
  // unabhängig vom aktuellen (nach dem Übernehmen wieder leeren) Live-Diff.
  const [appliedDiff, setAppliedDiff] = useState<OptimizerDiff | null>(null);
  const [preOptimize, setPreOptimize] = useState<{ formation: string; draftIds: string[] } | null>(null);

  const optimizer = useLineupOptimizer(data?.players ?? [], draftIds);

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
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSelectedBenchId(null);
    setSaveError(null);
    setAppliedDiff(null);
    setPreOptimize(null);
  }

  /** Veraltete Optimizer-Marker verwerfen — jeder manuelle Eingriff macht den eingefrorenen Diff ungültig. */
  function clearOptimizerMarkers() {
    setAppliedDiff(null);
    setPreOptimize(null);
  }

  function applyOptimization() {
    const best = optimizer.result.best;
    if (!best) return;
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

  function changeFormation(next: string) {
    clearOptimizerMarkers();
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
    clearOptimizerMarkers();
    if (selectedBenchId) {
      const benchPlayer = playersById.get(selectedBenchId);
      if (benchPlayer && benchPlayer.position === player.position) {
        setDraftIds((current) =>
          current.filter((id) => id !== player.id).concat(benchPlayer.id),
        );
        setSelectedBenchId(null);
      }
      return;
    }
    setDraftIds((current) => current.filter((id) => id !== player.id));
  }

  function tapBenchPlayer(player: SquadPlayer) {
    if (!editing) {
      openPlayer(player);
      return;
    }
    clearOptimizerMarkers();
    if (countByPosition[player.position] < required[player.position]) {
      setDraftIds((current) => current.concat(player.id));
      setSelectedBenchId(null);
    } else {
      setSelectedBenchId((current) => (current === player.id ? null : player.id));
    }
  }

  async function handleSave() {
    setSaveError(null);
    if (!hasOpenMatchday) {
      setSaveError('Deadline abgelaufen.');
      return;
    }
    try {
      await saveLineup.mutateAsync({ formation, playerIds: draftIds });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    }
  }

  function refetchAll() {
    return Promise.all([refetch(), matchdaysQuery.refetch(), leaguesQuery.refetch()]);
  }

  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  if (!data) {
    return <QueryState query={lineupQuery} label="Aufstellung" />;
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching || matchdaysQuery.isRefetching} onRefresh={refetchAll} tintColor={colors.accent} />
      }
    >
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
          {league && <Text style={styles.headerSub}>Budget {formatCurrency(league.budget)}</Text>}
        </View>
      </View>

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
        />
      )}

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
          {selectedBenchId
            ? 'Spieler auf dem Feld antippen, um zu tauschen.'
            : 'Startelf-Spieler antippen entfernt ihn auf die Bank. Bankspieler antippen füllt eine freie Position.'}
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
        budget={league?.budget ?? null}
        onSelectPlayer={openPlayer}
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
  formation: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
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

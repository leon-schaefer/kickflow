import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerDetail, SquadPlayer } from '@/api/kickbase';
import { Pitch } from '@/components/Pitch';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, violatedRules, type MaxPerTeamRule } from '@/lineup/rules';
import { useCompetitionTeams, useLeagueRanking, useManagerLineup, useMatchdays } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatPoints } from '@/utils/format';
import type { LineupMatchday } from '@/utils/matchday';
import { resolveLineupMatchday, resolveMatchdayState } from '@/utils/matchday';
import { countByPosition, countByTeam } from '@/utils/teamDistribution';
import { pointsPerMillion } from '@/utils/valueScore';

/**
 * Die Startelf eines Rivalen — Vereins-/Positionsverteilung plus Pitch-Ansicht.
 * Erreichbar durch Antippen einer Zeile in league.tsx. `lineupPlayerIds`
 * (aus `/leagues/{id}/ranking`) sind NUR die Startelf, nicht der ganze Kader
 * — Bankspieler eines Rivalen bleiben unsichtbar, das wird unten benannt.
 *
 * Die Elf kommt AUSDRÜCKLICH aus dem spieltagsbezogenen Ranking
 * (`?dayNumber=`), nicht aus der Saisonwertung: deren `lp[]` ist der Stand des
 * zuletzt abgerechneten Spieltags — also genau eine Runde zu alt. Welcher
 * Spieltag gefragt ist, entscheidet resolveLineupMatchday(): der laufende,
 * sonst der nächste offene. Gibt Kickbase dafür (noch) keine Elf heraus —
 * fremde Aufstellungen sind vor Anstoß nicht sichtbar —, fällt die Ansicht auf
 * die Saisonwertung zurück und sagt das in der Kopfzeile über dem Feld dazu.
 */
export default function ManagerDetailScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const backTitle = useFocusedLeagueTabTitle();
  const { managerId } = useLocalSearchParams<{ managerId: string }>();
  const router = useRouter();

  const rankingQuery = useLeagueRanking(leagueId);
  const entry = rankingQuery.data?.entries.find((e) => e.userId === managerId) ?? null;

  const { data: competitionTeams } = useCompetitionTeams(competitionId);
  const teamNames = useMemo(
    () => new Map((competitionTeams ?? []).map((team) => [team.id, team.name])),
    [competitionTeams],
  );

  // Minutentakt, damit der Wechsel „offen → läuft" beim Anstoß von selbst
  // greift, ohne dass der Screen neu geöffnet werden muss. Kein Request:
  // resolveMatchdayState() rechnet nur auf dem längst geladenen Spielplan.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const matchdaysQuery = useMatchdays(competitionId);
  const lineupMatchday = matchdaysQuery.data
    ? resolveLineupMatchday(resolveMatchdayState(matchdaysQuery.data, Date.now()), matchdaysQuery.data.currentDay)
    : null;
  // `lineupDay` als Primitive statt des Objekts: geht so unverändert in die
  // Query und in die Memo-Deps unten, ohne sie bei jedem Render zu kippen.
  const lineupDay = lineupMatchday?.day ?? null;
  const dayRankingQuery = useLeagueRanking(leagueId, lineupMatchday?.day, {
    enabled: lineupDay !== null,
    live: lineupMatchday?.phase === 'running',
  });

  // Nur EIN Memo für beides: `ids` muss über Renders hinweg stabil bleiben
  // (useManagerLineup feuert daraus eine Query je Spieler), und `fromDay`
  // hängt an derselben Entscheidung.
  const lineup = useMemo(() => {
    const seasonIds = entry?.lineupPlayerIds ?? [];
    // Ohne bekannten Spieltag zeigt `dayRankingQuery` (dayNumber === undefined)
    // dieselbe Saisonwertung wie oben — die dürfen wir dann NICHT als
    // spieltagsaktuell ausgeben.
    if (lineupDay === null) return { ids: seasonIds, fromDay: false };
    const dayRanking = dayRankingQuery.data;
    // Meldet die Antwort einen anderen Spieltag als den angefragten, hat
    // Kickbase `dayNumber` nicht berücksichtigt — dann ist ihre Elf nicht die
    // gesuchte, und die Kopfzeile soll das auch sagen.
    if (!dayRanking || (dayRanking.day !== null && dayRanking.day !== lineupDay)) {
      return { ids: seasonIds, fromDay: false };
    }
    const dayIds = dayRanking.entries.find((e) => e.userId === managerId)?.lineupPlayerIds ?? [];
    if (dayIds.some((id) => id !== null)) return { ids: dayIds, fromDay: true };
    return { ids: seasonIds, fromDay: false };
  }, [dayRankingQuery.data, entry, managerId, lineupDay]);

  const managerLineup = useManagerLineup(leagueId, lineup.ids);
  const refresh = useRefresh(rankingQuery, dayRankingQuery, matchdaysQuery, managerLineup);

  const players = useMemo(() => {
    const resolved: SquadPlayer[] = [];
    lineup.ids.forEach((playerId, index) => {
      if (!playerId) return;
      const detail = managerLineup.players.get(playerId);
      if (detail) resolved.push(toRivalSquadPlayer(detail, index));
    });
    return resolved;
  }, [lineup.ids, managerLineup.players]);

  const lineupLabel = describeLineupSource(
    lineupMatchday,
    lineup.fromDay,
    lineupDay !== null && dayRankingQuery.isPending,
  );

  const teamRows = useMemo(() => countByTeam(players, teamNames), [players, teamNames]);
  const positionRows = useMemo(() => countByPosition(players), [players]);
  const teamValue = useMemo(() => players.reduce((sum, p) => sum + p.marketValue, 0), [players]);
  const averagePoints = players.length > 0 ? players.reduce((sum, p) => sum + p.averagePoints, 0) / players.length : 0;

  // Liga-weite Regel (LeagueRulesProvider, siehe [leagueId]/_layout.tsx) auch
  // auf die Rivalen-Elf anwenden — sie gilt für jeden Manager gleich, nicht
  // nur für den eigenen Kader (rules.tsx). `players` ist hier NUR die Startelf
  // (siehe Doc-Kommentar oben), ein Verstoß ist also ein echter Regelbruch in
  // dessen Aufstellung, keine bloße Kaderauffälligkeit.
  const { rules } = useLeagueRulesContext();
  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;
  const violations = useMemo(
    () => violatedRules(rules, players, players.map((p) => p.id)),
    [rules, players],
  );
  const violatesMaxPerTeam = violations.some((rule) => rule.kind === 'maxPerTeam');

  /**
   * Dieselbe Route wie aus dem eigenen Aufstellungs-Tab und dem Kader — ein
   * Spieler auf einem fremden Feld ist derselbe Spieler. Ohne diesen Handler
   * blieb `Pitch` ohne `onSelectPlayer`, und `PlayerCard` rief ein
   * undefiniertes `onPress` auf: der Tap sah gedrückt aus und tat nichts.
   */
  function openPlayer(player: SquadPlayer) {
    router.push(`/${leagueId}/player/${player.id}`);
  }

  if (!rankingQuery.data) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <QueryState query={rankingQuery} label="Manager" refresh={refresh} />
      </>
    );
  }

  if (!entry) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Manager nicht gefunden.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>{entry.userName}</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.statsGrid}>
              <Stat label="Platz" value={entry.seasonPlace ? String(entry.seasonPlace) : '—'} />
              <Stat label="Saisonpunkte" value={formatPoints(entry.seasonPoints)} />
              <Stat label="Spieltagspunkte" value={formatPoints(entry.matchdayPoints)} />
              <Stat label="Teamwert (Liga)" value={formatCurrency(entry.teamValue)} />
            </View>

            <View style={styles.lineupHeader}>
              <Text style={styles.lineupTitle}>{lineupLabel.title}</Text>
              <Text style={styles.lineupHint}>{lineupLabel.hint}</Text>
              {players.length > 0 && (
                <Text style={styles.lineupHint}>Spieler antippen öffnet sein Profil.</Text>
              )}
            </View>

            {managerLineup.pending > 0 && (
              <Text style={styles.hint}>
                Elf wird geladen … {managerLineup.total - managerLineup.pending}/{managerLineup.total}
              </Text>
            )}

            {players.length > 0 && (
              <>
                <Pitch players={players} onSelectPlayer={openPlayer} />

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Startelf-Kennzahlen</Text>
                  <Text style={styles.cardLine}>Marktwert der Startelf: {formatCurrency(teamValue)}</Text>
                  <Text style={styles.cardLine}>Ø-Punkte der Startelf: {formatPoints(Math.round(averagePoints))}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Vereinsverteilung</Text>
                  {maxPerTeamRule.enabled && (
                    <Text style={styles.ruleHint}>Regel: max. {maxPerTeamRule.max} pro Verein</Text>
                  )}
                  {violatesMaxPerTeam && (
                    <Text style={styles.ruleViolation}>⚠ Verletzt: Max. {maxPerTeamRule.max} Spieler pro Verein</Text>
                  )}
                  {teamRows.map((row) => {
                    const overLimit = maxPerTeamRule.enabled && row.count > maxPerTeamRule.max;
                    return (
                      <View key={row.teamId} style={styles.distributionRow}>
                        <Text style={styles.distributionName}>{row.name}</Text>
                        <Text style={[styles.distributionCount, overLimit && styles.distributionCountOver]}>
                          {row.count}
                          {overLimit ? ' · über Grenze' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Positionsverteilung</Text>
                  {positionRows.map((row) => (
                    <View key={row.position} style={styles.distributionRow}>
                      <Text style={styles.distributionName}>{row.position}</Text>
                      <Text style={styles.distributionCount}>{row.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.disclaimer}>
              Nur die Startelf ist sichtbar — die Kickbase-API liefert für andere Manager keinen Bankspieler.
            </Text>
          </ScrollView>
        )}
      </Refreshable>
    </>
  );
}

/**
 * Kopfzeile über dem Feld: welcher Spieltag da steht und wie verlässlich er
 * ist. Ohne diese Zeile ist eine fremde Elf nicht interpretierbar — vor Anstoß
 * gibt Kickbase Aufstellungen anderer Manager nicht heraus, dann bleibt
 * zwangsläufig der letzte abgerechnete Spieltag stehen (`fromDay === false`).
 */
function describeLineupSource(
  matchday: LineupMatchday | null,
  fromDay: boolean,
  loading: boolean,
): { title: string; hint: string } {
  if (!fromDay) {
    return {
      title: 'Startelf · letzter abgerechneter Spieltag',
      hint: !matchday
        ? 'Spielplan noch nicht geladen — Stand aus der Saisonwertung.'
        : loading
          ? `Spieltag ${matchday.day} wird geladen …`
          : `Für Spieltag ${matchday.day} gibt Kickbase noch keine Elf dieses Managers heraus.`,
    };
  }
  if (matchday?.phase === 'running') {
    return {
      title: `Startelf · Spieltag ${matchday.day} (läuft)`,
      hint: 'Live-Stand — aktualisiert sich jede Minute von selbst.',
    };
  }
  if (matchday?.phase === 'open') {
    return {
      title: `Startelf · Spieltag ${matchday.day}`,
      hint: 'Aufstellung für den kommenden Spieltag.',
    };
  }
  return {
    title: `Startelf · Spieltag ${matchday?.day ?? '—'}`,
    hint: 'Von Kickbase als aktueller Spieltag gemeldet.',
  };
}

/**
 * `PlayerDetail` (aus getPlayerBasic) → `SquadPlayer`, damit `Pitch`/`PlayerCard`
 * unverändert wiederverwendbar bleiben. Felder, die `PlayerDetail` nicht kennt
 * (Kader-/Marktkontext eines FREMDEN Managers — Kapitän, Bankstatus, eigenes
 * Gebot …), bekommen neutrale Defaults; `PlayerCard` liest sie ohnehin nicht.
 */
function toRivalSquadPlayer(detail: PlayerDetail, lineupSlot: number): SquadPlayer {
  return {
    id: detail.id,
    name: detail.name,
    firstName: detail.firstName,
    lastName: detail.lastName,
    position: detail.position,
    teamId: detail.teamId,

    marketValue: detail.marketValue,
    marketValueTrend: detail.marketValueTrend,
    marketValueChangeToday: 0,

    totalPoints: detail.totalPoints,
    averagePoints: detail.averagePoints,
    valueScoreAvg: pointsPerMillion(detail.averagePoints, detail.marketValue),
    valueScoreTotal: pointsPerMillion(detail.totalPoints, detail.marketValue),

    status: detail.status,
    statusDetails: detail.statusDetails,

    imageUrl: detail.imageUrl,
    teamLogoUrl: detail.teamLogoUrl,

    inLineup: true,
    lineupSlot,
    isCaptain: false,

    onMarket: false,
    offerCount: 0,

    nextMatch: null,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    width: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  statValue: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  lineupHeader: {
    gap: 2,
  },
  lineupTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  lineupHint: {
    ...typography.small,
    color: colors.textMuted,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  distributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  distributionName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  distributionCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  distributionCountOver: {
    color: colors.danger,
    fontWeight: '600',
  },
  ruleHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  ruleViolation: {
    ...typography.small,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
  },
});

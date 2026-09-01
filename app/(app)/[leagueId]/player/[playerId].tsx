import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketValueSparkline } from '@/components/MarketValueSparkline';
import { MatchdayRow } from '@/components/MatchdayRow';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { StatusBadge } from '@/components/StatusBadge';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCompetitionTeams, useLineup, usePlayer } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import {
  formatCurrency,
  formatDelta,
  formatMinutes,
  formatPercentDelta,
  formatPoints,
  formatPointsPerMinute,
} from '@/utils/format';
import { purchaseDelta } from '@/utils/purchase';
import { EMPTY_PLAYTIME, latestSeason, pointsPerMinute, sumPlaytime } from '@/utils/playtime';

type Timeframe = 92 | 365;

export default function PlayerDetailScreen() {
  const leagueId = useLeagueId();
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const playerQuery = usePlayer(leagueId, playerId);
  const { data: player } = playerQuery;
  const refresh = useRefresh(playerQuery);
  const [timeframe, setTimeframe] = useState<Timeframe>(92);
  const backTitle = useFocusedLeagueTabTitle();

  const competitionId = useCompetitionId();
  const { data: competitionTeams } = useCompetitionTeams(competitionId);
  const teamNames = useMemo(
    () => new Map((competitionTeams ?? []).map((team) => [team.id, team.name])),
    [competitionTeams],
  );

  // Der Kaufpreis steckt nur im Kader (`mvgl`), nicht in der Spieler-Detail-
  // Antwort. Der Query ist über den Kader-/Aufstellungs-Tab praktisch immer
  // warm — der Screen wartet aber nie darauf: fehlen die Kaderdaten (fremder
  // Spieler, noch am Laden, Request gescheitert), fällt die Kauf-Anzeige
  // ersatzlos weg statt einen Platzhalter zu zeigen.
  const { data: lineup } = useLineup(leagueId);
  const squadPlayer = useMemo(
    () => lineup?.players.find((p) => p.id === playerId) ?? null,
    [lineup, playerId],
  );
  // Bewusst aus dem Kader-Marktwert gerechnet und nicht aus player.marketValue:
  // nur so ist `gain` exakt das rohe `mvgl` und driftet nicht zwischen den
  // beiden Endpunkten auseinander.
  const purchase = squadPlayer
    ? purchaseDelta(squadPlayer.marketValue, squadPlayer.purchasePrice)
    : null;

  if (!player) {
    return (
      <>
        <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
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

  return (
    <>
      <Stack.Screen.BackButton>{backTitle}</Stack.Screen.BackButton>
      <Stack.Title>{player.name}</Stack.Title>
      <Refreshable {...refresh}>
        {(p) => (
          <ScrollView {...p} style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {player.imageUrl ? (
            <Image source={{ uri: player.imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.team}>{player.teamName || '—'}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.positionTag, { backgroundColor: `${positionColors[player.position]}26` }]}>
                <Text style={[styles.positionText, { color: positionColors[player.position] }]}>
                  {positionLabels[player.position]}
                </Text>
              </View>
              <StatusBadge status={player.status} />
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Marktwert" value={formatCurrency(player.marketValue)} />
          {purchase && <Stat label="Kaufpreis" value={formatCurrency(purchase.purchasePrice)} />}
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
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Marktwertverlauf</Text>
            <View style={styles.timeframeToggle}>
              {([92, 365] as const).map((tf) => (
                <Pressable
                  key={tf}
                  style={[styles.timeframeChip, timeframe === tf && styles.timeframeChipActive]}
                  onPress={() => setTimeframe(tf)}
                >
                  <Text
                    style={[styles.timeframeText, timeframe === tf && styles.timeframeTextActive]}
                  >
                    {tf === 92 ? '3 Monate' : '1 Jahr'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <MarketValueSparkline
            points={history.points}
            referenceValue={purchase?.purchasePrice ?? null}
          />
          {purchase && (
            <View style={styles.purchaseRow}>
              <View style={styles.purchaseLegend}>
                <View style={styles.purchaseDash} />
                <View style={styles.purchaseDash} />
                <View style={styles.purchaseDash} />
              </View>
              <Text style={styles.minMaxText}>
                Kaufpreis {formatCurrency(purchase.purchasePrice)}
              </Text>
              <Text
                style={[
                  styles.purchaseDelta,
                  {
                    color:
                      purchase.gain > 0
                        ? colors.positive
                        : purchase.gain < 0
                          ? colors.negative
                          : colors.textMuted,
                  },
                ]}
              >
                {formatDelta(purchase.gain)} ({formatPercentDelta(purchase.percent)})
              </Text>
            </View>
          )}
          <View style={styles.minMaxRow}>
            <Text style={styles.minMaxText}>Tief {formatCurrency(history.lowest)}</Text>
            <Text style={styles.minMaxText}>Hoch {formatCurrency(history.highest)}</Text>
          </View>
        </View>

        {season && playedMatchdays.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Spieltage {season.title}</Text>
              <Text style={styles.legend}>H = Heim · A = Auswärts</Text>
            </View>
            {playedMatchdays.map((md) => (
              <MatchdayRow key={md.matchday} matchday={md} playerTeamId={player.teamId} teamNames={teamNames} />
            ))}
          </View>
        )}
          </ScrollView>
        )}
      </Refreshable>
    </>
  );
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
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  imageFallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...typography.title,
    color: colors.textPrimary,
  },
  team: {
    ...typography.body,
    color: colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: 2,
  },
  positionTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  positionText: {
    ...typography.small,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stat: {
    width: '30%',
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
  section: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  legend: {
    ...typography.small,
    color: colors.textMuted,
  },
  timeframeToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timeframeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeframeChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  timeframeText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  timeframeTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  minMaxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Miniatur der gestrichelten Kaufpreis-Linie im Chart — ohne sie ist nicht
  // erkennbar, welche der beiden gestrichelten Linien gemeint ist.
  purchaseLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  purchaseDash: {
    width: 4,
    height: 1,
    backgroundColor: colors.textSecondary,
  },
  purchaseDelta: {
    ...typography.caption,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  minMaxText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

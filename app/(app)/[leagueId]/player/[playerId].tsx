import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerTransfer } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { FixtureDifficultyStrip } from '@/components/FixtureDifficultyStrip';
import { MarketValueSparkline } from '@/components/MarketValueSparkline';
import { MatchdayRow } from '@/components/MatchdayRow';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { StatusBadge } from '@/components/StatusBadge';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useFocusedLeagueTabTitle } from '@/leagues/useFocusedLeagueTabTitle';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useMarkInteractive } from '@/observe/useMarkInteractive';
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
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import { buildFixtureIndex, fixtureDifficulty, remainingFixtures, teamGoalRecord, teamStrength } from '@/utils/fixtureDifficulty';
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

/** Wie viele kommende Spiele im "Nächste Gegner"-Streifen stehen — passend zur Standard-Ansicht des Restprogramm-Screens. */
const NEXT_OPPONENTS_COUNT = 5;

type Timeframe = 92 | 365;

export default function PlayerDetailScreen() {
  const leagueId = useLeagueId();
  const { userId } = useAuth();
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const playerQuery = usePlayer(leagueId, playerId);
  const { data: player } = playerQuery;
  useMarkInteractive(!!player);
  const [timeframe, setTimeframe] = useState<Timeframe>(92);
  const backTitle = useFocusedLeagueTabTitle();

  const competitionId = useCompetitionId();
  const router = useRouter();
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

  // Solange eine Quelle noch lädt, ist „Besitzer unbekannt“ verfrüht — das ist
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
  // (app/(app)/[leagueId]/fixtures.tsx), nur auf diesen einen Spieler und
  // dessen Position zugeschnitten. Ohne geladenen Spielplan bleibt es leer.
  const nextOpponentRatings = useMemo(() => {
    if (!player || !matchdaysQuery.data) return [];
    const schedule = matchdaysQuery.data;
    const fromDay = resolveMatchdayState(schedule, Date.now()).open?.day ?? schedule.currentDay ?? 1;
    const index = buildFixtureIndex(schedule);
    const strengths = teamStrength(teamGoalRecord(schedule));
    const upcoming = remainingFixtures(player.teamId, index, fromDay, NEXT_OPPONENTS_COUNT);
    return fixtureDifficulty(upcoming, strengths);
  }, [player, matchdaysQuery.data]);
  // Torwart/Abwehr: relevant ist die Angriffsgefahr der Gegner (defenseDifficulty).
  // Mittelfeld/Sturm: relevant ist deren Abwehrstärke (attackDifficulty). Siehe
  // positionDifficulty() in fixtureDifficulty.ts für dieselbe Zuordnung beim Optimizer.
  const nextOpponentLens = player && (player.position === 'GK' || player.position === 'DEF') ? 'defense' : 'attack';

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
            {player.statusDetails.length > 0 && (
              <Text style={styles.statusDetails}>{player.statusDetails.join(' · ')}</Text>
            )}
            <OwnerLine
              owner={owner}
              pending={ownerSourcesPending}
              onOpenManager={
                owner.userId
                  ? () =>
                      router.push({
                        pathname: '/[leagueId]/manager/[managerId]',
                        params: { leagueId, managerId: owner.userId! },
                      })
                  : undefined
              }
            />
            {inOwnSquad && <PurchaseLine purchase={purchase} pending={transfersQuery.isPending} />}
          </View>
        </View>

        <View style={styles.statsGrid}>
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
        </View>

        {nextOpponentRatings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nächste Gegner</Text>
            <FixtureDifficultyStrip
              ratings={nextOpponentRatings}
              lens={nextOpponentLens}
              size={44}
              showOpponentLogos
            />
          </View>
        )}

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
          <MarketValueSparkline points={history.points} />
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

/**
 * "Gekauft am 12.08.2026" — wann der Spieler in den eigenen Kader gewechselt
 * ist, aus seiner Transferhistorie abgeleitet (siehe resolveOwnPurchase).
 * Steht nur bei eigenen Spielern.
 *
 * Ohne belegbaren Kauf bleibt die Zeile WEG statt „unbekannt“ anzuzeigen:
 * Kickbase führt nicht zu jedem Spieler eine Transferhistorie (ein von Beginn
 * an gehaltener Spieler hat schlicht keine), und ein Zusatzrequest, der
 * ausfällt, soll auf dem Screen keine Fehlermeldung hinterlassen.
 */
function PurchaseLine({ purchase, pending }: { purchase: PlayerTransfer | null; pending: boolean }) {
  if (pending) {
    return <Text style={[styles.purchase, styles.purchasePending]}>Gekauft …</Text>;
  }
  const date = purchase ? formatIsoDate(purchase.date) : null;
  if (!date) return null;
  return <Text style={styles.purchase}>Gekauft am {date}</Text>;
}

/**
 * Wem der Spieler gehört. „Besitzer unbekannt“ ist hier eine echte Aussage und
 * kein Fehler: Kickbase legt von fremden Managern nur die Startelf offen, ein
 * Bankspieler eines Rivalen ist von einem ungekauften Spieler nicht zu
 * unterscheiden (siehe resolvePlayerOwner). Deshalb steht dort auch nie
 * „frei“ — nur beim Kickbase-Angebot ist belegt, dass ihn kein Manager hat.
 */
function OwnerLine({
  owner,
  pending,
  onOpenManager,
}: {
  owner: PlayerOwnerInfo;
  /** Eine der Besitzer-Quellen lädt noch — dann ist „unbekannt“ noch keine Antwort. */
  pending: boolean;
  onOpenManager?: () => void;
}) {
  if (owner.kind === 'unknown' && pending) {
    return <Text style={[styles.owner, styles.ownerUnknown]}>Besitzer …</Text>;
  }

  const label =
    owner.kind === 'me'
      ? 'In deinem Kader'
      : owner.kind === 'manager'
        ? `Kader von ${owner.name ?? 'einem Manager'}`
        : owner.kind === 'free'
          ? 'Kein Manager · Kickbase-Angebot'
          : 'Besitzer unbekannt';

  const text = (
    <Text style={[styles.owner, owner.kind === 'unknown' && styles.ownerUnknown]}>
      {label}
      {owner.onMarket && ' · am Markt'}
      {onOpenManager && ' ›'}
    </Text>
  );

  // Nur antippbar, wenn wir eine User-ID haben — ein toter Druckbereich wäre
  // schlechter als reiner Text.
  return onOpenManager ? (
    <Pressable onPress={onOpenManager} accessibilityRole="button">
      {text}
    </Pressable>
  ) : (
    text
  );
}

const styles = StyleSheet.create({
  owner: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  ownerUnknown: {
    color: colors.textMuted,
  },
  purchase: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  purchasePending: {
    color: colors.textMuted,
  },
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
  statusDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
  minMaxText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

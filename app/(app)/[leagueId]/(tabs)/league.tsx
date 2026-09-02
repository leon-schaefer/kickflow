import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LeagueRankingEntry } from '@/api/kickbase';
import { MaxPerTeamRuleCard } from '@/components/MaxPerTeamRuleCard';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useAuth } from '@/auth/AuthProvider';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, type MaxPerTeamRule } from '@/lineup/rules';
import { useLeagueRanking, useMatchdays } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { resolveMatchdayState } from '@/utils/matchday';
import { formatCurrency, formatPoints } from '@/utils/format';

/**
 * Liga-Tabelle über `/v4/leagues/{id}/ranking` — die größte bisher fehlende
 * Säule gegenüber Kickly/Base XI (siehe Plan „Liga-Tab"). Zeigt Platzierung,
 * Punkte und Teamwert jedes Managers; ein Antippen öffnet dessen Startelf
 * (manager/[managerId].tsx). Season-Ansicht only — ein Spieltags-Umschalter
 * (dayNumber) ist bewusst nicht Teil dieser ersten Version.
 *
 * Kopfbereich zeigt zusätzlich, sofern vorhanden: das aktuelle Duell (Kickbases
 * Kopf-an-Kopf-Modus, `hhoui` auf LeagueRankingEntry) und die liga-eigene
 * maxPerTeam-Regel (bisher nur über rules.tsx erreichbar) — beides betrifft die
 * ganze Liga, nicht nur den eigenen Kader, gehört also hierher.
 */
export default function LeagueScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const router = useRouter();
  const { userId } = useAuth();
  const rankingQuery = useLeagueRanking(leagueId);
  const { data } = rankingQuery;
  const matchdaysQuery = useMatchdays(competitionId);
  const { rules, updateRule, loaded, leagueMax } = useLeagueRulesContext();
  const refresh = useRefresh(rankingQuery);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.entries].sort((a, b) => a.seasonPlace - b.seasonPlace);
  }, [data]);

  // Anders als in fixtures.tsx/lineup.tsx zählt hier der LAUFENDE Spieltag
  // zuerst, nicht der nächste offene — das Duell interessiert während des
  // Spieltags, nicht erst danach.
  const matchdayState = useMemo(() => {
    if (!matchdaysQuery.data) return null;
    return resolveMatchdayState(matchdaysQuery.data, Date.now());
  }, [matchdaysQuery.data]);
  const matchday = matchdayState?.running?.day ?? matchdayState?.open?.day ?? matchdaysQuery.data?.currentDay ?? null;

  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;

  if (!data) {
    return <QueryState query={rankingQuery} label="Liga-Tabelle" refresh={refresh} />;
  }

  const own = data.entries.find((e) => e.userId === userId) ?? null;
  // `h2hOpponentUserId` fehlt in Ligen ohne Duell-Modus komplett (siehe
  // LeagueRankingEntry) — Karte und Zeilen-Highlight entfallen dann lautlos.
  const opponent = own?.h2hOpponentUserId
    ? (data.entries.find((e) => e.userId === own.h2hOpponentUserId) ?? null)
    : null;

  function openManager(entry: LeagueRankingEntry) {
    router.push(`/${leagueId}/manager/${entry.userId}`);
  }

  return (
    <View style={styles.container}>
      <Refreshable {...refresh}>
        {(p) => (
          <FlatList
            {...p}
            data={rows}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <ManagerRow
                entry={item}
                isOwn={item.userId === userId}
                isOpponent={opponent !== null && item.userId === opponent.userId}
                onPress={openManager}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              (own && opponent) || loaded ? (
                <View style={styles.headerCards}>
                  {own && opponent && (
                    <DuelCard own={own} opponent={opponent} matchday={matchday} onPress={() => openManager(opponent)} />
                  )}
                  {loaded && (
                    <MaxPerTeamRuleCard
                      rule={maxPerTeamRule}
                      onChange={(patch) => updateRule('maxPerTeam', patch)}
                      leagueMax={leagueMax}
                    />
                  )}
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Keine Liga-Tabelle gefunden.</Text>
              </View>
            }
          />
        )}
      </Refreshable>
    </View>
  );
}

function DuelCard({
  own,
  opponent,
  matchday,
  onPress,
}: {
  own: LeagueRankingEntry;
  opponent: LeagueRankingEntry;
  matchday: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.duelCard} onPress={onPress}>
      <Text style={styles.duelTitle}>{matchday ? `Dein Duell · Spieltag ${matchday}` : 'Dein Duell'}</Text>
      <View style={styles.duelRow}>
        <Text style={styles.duelScore}>
          Du {formatPoints(own.matchdayPoints)} : {formatPoints(opponent.matchdayPoints)} {opponent.userName}
        </Text>
        {opponent.userImageUrl ? (
          <Image source={{ uri: opponent.userImageUrl }} style={styles.duelAvatar} />
        ) : (
          <View style={[styles.duelAvatar, styles.avatarFallback]} />
        )}
      </View>
      {own.h2hPlace > 0 && <Text style={styles.duelPlace}>Duell-Platz {own.h2hPlace}</Text>}
    </Pressable>
  );
}

function ManagerRow({
  entry,
  isOwn,
  isOpponent,
  onPress,
}: {
  entry: LeagueRankingEntry;
  isOwn: boolean;
  isOpponent: boolean;
  onPress: (entry: LeagueRankingEntry) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(entry)}
      style={({ pressed }) => [
        styles.row,
        isOpponent && styles.rowOpponent,
        isOwn && styles.rowOwn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.place}>{entry.seasonPlace || '—'}</Text>

      {entry.userImageUrl ? (
        <Image source={{ uri: entry.userImageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]} />
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.userName}
          </Text>
          {entry.isAdmin && <Text style={styles.adminTag}>Admin</Text>}
          {isOpponent && <Text style={styles.duelTag}>Duell</Text>}
        </View>
        <Text style={styles.subText}>
          {entry.hasLineupSet ? 'Aufstellung steht' : 'Aufstellung offen'} · {formatCurrency(entry.teamValue)}
        </Text>
      </View>

      <View style={styles.scores}>
        <Text style={styles.seasonPoints}>{formatPoints(entry.seasonPoints)}</Text>
        <Text style={styles.matchdayPoints}>ST {formatPoints(entry.matchdayPoints)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowOwn: {
    backgroundColor: colors.accentMuted,
  },
  rowOpponent: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  headerCards: {
    padding: spacing.md,
    gap: spacing.md,
  },
  duelCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  duelTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  duelScore: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  duelAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  duelPlace: {
    ...typography.small,
    color: colors.textMuted,
  },
  duelTag: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
  place: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },
  avatarFallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  adminTag: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
  subText: {
    ...typography.small,
    color: colors.textMuted,
  },
  scores: {
    alignItems: 'flex-end',
    gap: 2,
  },
  seasonPoints: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  matchdayPoints: {
    ...typography.small,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 24 + spacing.sm + 36 + spacing.sm,
  },
});

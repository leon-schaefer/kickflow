import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { LeagueManager } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { ManagerRow } from '@/components/ManagerRow';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useLeagueRanking } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { colors, layout, spacing, typography } from '@/theme/tokens';

/**
 * Liga-Tab: die Tabelle aller Manager. Jede Zeile führt in die Aufstellung
 * des jeweiligen Managers — von dort aus ist jeder Spieler antippbar.
 */
export default function LeagueScreen() {
  const leagueId = useLeagueId();
  const router = useRouter();
  const rankingQuery = useLeagueRanking(leagueId);
  const { data: managers } = rankingQuery;
  const refresh = useRefresh(rankingQuery);
  // `userName` steht nur nach einem frischen Login zur Verfügung (der
  // AuthProvider stellt aus dem Store nur den Token wieder her) — nach einem
  // App-Neustart bleibt die eigene Zeile deshalb unmarkiert. Kein Grund für
  // einen Zusatzrequest: die Tabelle funktioniert auch ohne „Du“.
  const { userName } = useAuth();

  function openManager(manager: LeagueManager) {
    router.push(`/${leagueId}/manager/${manager.id}`);
  }

  if (!managers) {
    return <QueryState query={rankingQuery} label="Liga" refresh={refresh} />;
  }

  return (
    <View style={styles.container}>
      <Refreshable {...refresh}>
        {(p) => (
          <FlatList
            {...p}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={managers}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <Text style={styles.hint}>
                Manager antippen zeigt seine Aufstellung — Spieler antippen das Spielerprofil.
              </Text>
            }
            renderItem={({ item }) => (
              <ManagerRow
                manager={item}
                onPress={openManager}
                isSelf={!!userName && item.name === userName}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.emptyText}>Keine Manager gefunden.</Text>}
          />
        )}
      </Refreshable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});

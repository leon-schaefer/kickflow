import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LeagueSummary } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { setLastLeagueId } from '@/leagues/lastLeague';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useLeagues } from '@/queries/hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Ersetzt den Tab-Header-Titel: zeigt die aktuelle Liga und öffnet per Tap
 * ein Modal zum Wechseln, ohne den Picker (`/leagues`) betreten zu müssen.
 * Vorher gab es aus einer Liga heraus keinen Weg zurück, weil der
 * `[leagueId]`-Screen `headerShown: false` hat (app/(app)/_layout.tsx).
 */
export function LeagueSwitcher() {
  const leagueId = useLeagueId();
  const currentLeague = useCurrentLeague();
  const leaguesQuery = useLeagues();
  const { data: leagues } = leaguesQuery;
  const [open, setOpen] = useState(false);

  async function selectLeague(league: LeagueSummary) {
    setOpen(false);
    if (league.id === leagueId) return;
    await setLastLeagueId(league.id);
    router.replace(`/${league.id}/lineup`);
  }

  function openLeaguesScreen() {
    setOpen(false);
    router.navigate('/leagues');
  }

  function openSettings() {
    setOpen(false);
    router.navigate('/settings');
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} hitSlop={spacing.sm}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {currentLeague?.name ?? 'Liga'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>Liga wechseln</Text>
            {!leagues ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : (
              <FlatList
                data={leagues}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable style={styles.row} onPress={() => selectLeague(item)}>
                    <Text style={styles.rowText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.id === leagueId && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                )}
              />
            )}
            <View style={styles.footerRow}>
              <Pressable style={styles.footer} onPress={openLeaguesScreen}>
                <Text style={styles.footerText}>Meine Ligen</Text>
              </Pressable>
              <Pressable style={styles.footer} onPress={openSettings}>
                <Text style={styles.footerText}>Einstellungen</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 220,
  },
  triggerText: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  chevron: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  panelTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  loading: {
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  checkmark: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  footer: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});

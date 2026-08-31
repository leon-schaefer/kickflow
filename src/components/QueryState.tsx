import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { type RefreshState, useRefresh } from '@/queries/useRefresh';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { Refreshable } from './Refreshable';

interface QueryLike {
  error: unknown;
  refetch: () => Promise<unknown>;
}

interface Props {
  /** Das Query-Objekt von useQuery — nur error/refetch werden gebraucht. */
  query: QueryLike;
  /** z.B. "Kader" -> "Kader konnte nicht geladen werden." */
  label: string;
  /**
   * Refresh-State des aufrufenden Screens (z.B. aus useRefresh(mehrere,
   * queries)), damit ein Pull auch im Lade-/Fehlerzustand alles neu lädt,
   * was der Screen zeigt — nicht nur `query`. Fehlt er, baut sich QueryState
   * selbst einen aus `query`.
   */
  refresh?: RefreshState;
}

/**
 * Rendert Lade- bzw. Fehlerzustand eines Queries. Wird nur aufgerufen, wenn
 * noch keine Daten da sind (`!data`) — ein deaktivierter Query (kein Fehler,
 * nur `enabled: false`) zeigt hier also den Spinner statt einer Fehlermeldung,
 * die es vorher fälschlich war, sobald z.B. ein Tab-Wechsel den Query kurz
 * deaktiviert hat.
 *
 * In eine `Refreshable` gewickelt, damit auch dieser Zustand ziehbar ist —
 * gerade wenn das Laden fehlschlägt, ist das der Moment, in dem man
 * instinktiv zieht.
 */
export function QueryState({ query, label, refresh }: Props) {
  const ownRefresh = useRefresh(query);
  const { refreshing, onRefresh } = refresh ?? ownRefresh;

  return (
    <Refreshable refreshing={refreshing} onRefresh={onRefresh}>
      {(p) => (
        <ScrollView {...p} style={styles.scroll} contentContainerStyle={styles.center}>
          {query.error ? (
            <>
              <Text style={styles.errorText}>
                {query.error instanceof Error ? query.error.message : `${label} konnte nicht geladen werden.`}
              </Text>
              <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
                <Text style={styles.retryButtonText}>Erneut versuchen</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </ScrollView>
      )}
    </Refreshable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});

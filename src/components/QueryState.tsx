import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface QueryLike {
  error: unknown;
  refetch: () => unknown;
}

interface Props {
  /** Das Query-Objekt von useQuery — nur error/refetch werden gebraucht. */
  query: QueryLike;
  /** z.B. "Kader" -> "Kader konnte nicht geladen werden." */
  label: string;
}

/**
 * Rendert Lade- bzw. Fehlerzustand eines Queries. Wird nur aufgerufen, wenn
 * noch keine Daten da sind (`!data`) — ein deaktivierter Query (kein Fehler,
 * nur `enabled: false`) zeigt hier also den Spinner statt einer Fehlermeldung,
 * die es vorher fälschlich war, sobald z.B. ein Tab-Wechsel den Query kurz
 * deaktiviert hat.
 */
export function QueryState({ query, label }: Props) {
  if (query.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {query.error instanceof Error ? query.error.message : `${label} konnte nicht geladen werden.`}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
          <Text style={styles.retryButtonText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
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

import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface SortChipsProps<K extends string> {
  /** `dividerBefore`: Trenner vor diesem Chip, z. B. zwischen den absoluten und den Wert-Kennzahlen im Spieler-Tab. */
  options: readonly { key: K; label: string; dividerBefore?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  /** Vorangestellte Chips + Divider, z. B. „Nur meine Gebote" im Markt-Tab. */
  leading?: ReactNode;
}

/**
 * Horizontal scrollende Sortier-Chip-Leiste, geteilt zwischen Kader- und
 * Markt-Tab. `chipScroll`/`chipRow` brauchen BEIDE `minHeight: 50`: RN misst
 * die Content-Höhe einer horizontalen ScrollView falsch, sobald der Inhalt
 * wirklich breiter als der Screen ist und gescrollt werden muss — dann
 * schrumpfen die Chips auf reine Texthöhe ohne Padding. `chipScroll` bestimmt
 * die Höhe des sichtbaren Viewports, `chipRow` die des scrollbaren Inhalts;
 * ohne beide bleibt der Viewport bei der falsch gemessenen (zu kleinen) Höhe
 * und schneidet den Inhalt unten ab.
 */
export function SortChips<K extends string>({ options, value, onChange, leading }: SortChipsProps<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
    >
      {leading}
      {options.map((option) => (
        <View key={option.key} style={styles.chipEntry}>
          {option.dividerBefore && <SortChipsDivider />}
          <Pressable
            style={[styles.sortChip, value === option.key && styles.sortChipActive]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.sortChipText, value === option.key && styles.sortChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

export function SortChipsDivider() {
  return <View style={styles.chipDivider} />;
}

const styles = StyleSheet.create({
  // ScrollView setzt intern flexGrow: 1 (auch horizontal) — ohne das hier auf 0
  // zu setzen, füllt die Zeile den ganzen restlichen Screen-Platz.
  chipScroll: {
    flexGrow: 0,
    minHeight: 50,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 50,
  },
  chipEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  sortChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});

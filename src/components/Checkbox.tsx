import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Kleiner Hinweistext unter dem Label, z.B. warum die Checkbox deaktiviert ist. */
  hint?: string;
}

/**
 * Erste Checkbox der App — bisher gab es dafür kein Vorbild, nur das
 * hartcodierte "✓" in LeagueSwitcher.tsx für eine reine Auswahlanzeige.
 * Farben/Radius folgen der bestehenden Chip-Konvention (z.B. OptimizerBar
 * metricChipActive): aktiv = accentMuted-Füllung + accent-Rand.
 */
export function Checkbox({ label, checked, onChange, disabled, hint }: CheckboxProps) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.label}>{label}</Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
});

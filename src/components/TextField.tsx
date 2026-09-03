import type { ReactNode } from 'react';
import { useRef } from 'react';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { ClearIcon } from './icons/ClearIcon';

export interface TextFieldProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Rahmen um Eingabe, X und Suffix — z.B. `flex: 1` für eine Zeile mit Nachbarn. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Steht rechts vom X, z.B. eine Einheit wie „€“ (siehe OfferModal). */
  suffix?: ReactNode;
  /** Standard: „Eingabe löschen“. */
  clearAccessibilityLabel?: string;
}

/**
 * Eingabefeld mit X am Ende zum Leeren. Ersetzt iOS' `clearButtonMode`, das es
 * auf Android und Web nicht gibt — so verhält sich das Feld überall gleich.
 *
 * `style` gilt weiter für die Eingabe selbst (Text, Innenabstand), der Rahmen
 * steckt im Container: `containerStyle`.
 */
export function TextField({
  value,
  onChangeText,
  containerStyle,
  suffix,
  clearAccessibilityLabel = 'Eingabe löschen',
  style,
  ...inputProps
}: TextFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const editable = inputProps.editable ?? true;

  function clear() {
    onChangeText('');
    // Tippen auf das X nimmt dem Feld den Fokus. Zurückholen nur, wenn es ihn
    // vorher hatte: sonst fährt beim Aufräumen ungefragt die Tastatur hoch.
    if (inputRef.current?.isFocused()) inputRef.current.focus();
  }

  return (
    <View style={[styles.field, containerStyle]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        // Sonst liegt auf iOS zusätzlich das systemeigene X im Feld.
        clearButtonMode="never"
        {...inputProps}
      />
      {editable && value.length > 0 && (
        <Pressable
          onPress={clear}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          style={styles.clearButton}
        >
          <ClearIcon color={colors.textMuted} />
        </Pressable>
      )}
      {suffix}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  clearButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
  },
});

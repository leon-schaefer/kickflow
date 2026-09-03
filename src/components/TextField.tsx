import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { BlurEvent, FocusEvent, StyleProp, TextInputProps, ViewStyle } from 'react-native';
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
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const editable = inputProps.editable ?? true;

  function clear() {
    onChangeText('');
    // Der Klick aufs X nimmt dem Feld den Fokus (auf Web schon beim mousedown,
    // also bevor dieser Handler läuft). Ohne das Zurückholen müsste man erst
    // wieder hineinklicken, um nach dem Leeren weiterzutippen.
    inputRef.current?.focus();
  }

  function handleFocus(event: FocusEvent) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: BlurEvent) {
    setFocused(false);
    onBlur?.(event);
  }

  return (
    // Der Fokusrahmen steht bewusst hinter containerStyle: er soll sich nicht
    // von einem Aufrufer wegkonfigurieren lassen.
    <View style={[styles.field, containerStyle, focused && styles.fieldFocused]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
  fieldFocused: {
    borderColor: colors.accent,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    // Der Rahmen sitzt am Container, nicht am <input> — den Fokusring würde
    // der Browser deshalb als eckigen Kasten INS Feld zeichnen. Statt seinem
    // `outline: auto` hier eine eigene Breite von 0: das nimmt den Ring weg,
    // den Fokus zeigt stattdessen `fieldFocused` am ganzen Feldrahmen.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  clearButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
  },
});

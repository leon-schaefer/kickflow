import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useRef } from 'react';
import { cx } from '@/utils/cx';
import styles from './TextField.module.css';
import { ClearIcon } from './icons/ClearIcon';

export interface TextFieldProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'className'> {
  value: string;
  /** Bekommt den Text, nicht das Event — wie bei Checkbox.onChange. */
  onChange: (text: string) => void;
  /** Klasse für den Rahmen um Eingabe, X und Suffix — z.B. `flex: 1` für eine Zeile mit Nachbarn. */
  className?: string;
  /** Klasse für das `<input>` selbst, z.B. ein anderer Innenabstand. */
  inputClassName?: string;
  /** Steht rechts vom X, z.B. eine Einheit wie „€“ (siehe OfferModal). */
  suffix?: ReactNode;
  /** Standard: „Eingabe löschen“. */
  clearLabel?: string;
}

/**
 * Eingabefeld mit X am Ende zum Leeren. Ersetzt iOS' `clearButtonMode`, das es
 * auf Android und Web nicht gibt — so verhält sich das Feld überall gleich.
 *
 * Der Fokuszustand ist mit dem Port State-frei geworden: `:focus-within` am
 * Rahmen leistet, wofür die React-Native-Fassung ein `useState` plus
 * onFocus/onBlur-Weiterleitung brauchte. Der Rahmen sitzt weiter am Container
 * (`className`), der Innenabstand am Input (`inputClassName`).
 */
export function TextField({
  value,
  onChange,
  className,
  inputClassName,
  suffix,
  clearLabel = 'Eingabe löschen',
  ...inputProps
}: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editable = !inputProps.disabled && !inputProps.readOnly;

  function clear() {
    onChange('');
    // Der Klick aufs X nimmt dem Feld den Fokus (schon beim mousedown, also
    // bevor dieser Handler läuft). Ohne das Zurückholen müsste man erst
    // wieder hineinklicken, um nach dem Leeren weiterzutippen.
    inputRef.current?.focus();
  }

  return (
    <div className={cx(styles.field, className)}>
      <input
        ref={inputRef}
        type="text"
        className={cx(styles.input, inputClassName)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      {editable && value.length > 0 && (
        <button type="button" className={styles.clearButton} onClick={clear} aria-label={clearLabel}>
          <ClearIcon />
        </button>
      )}
      {suffix}
    </div>
  );
}

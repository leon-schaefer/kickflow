import styles from './Checkbox.module.css';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Kleiner Hinweistext unter dem Label, z.B. warum die Checkbox deaktiviert ist. */
  hint?: string;
}

/**
 * Farben und Radius folgen der Chip-Konvention der App (OptimizerBar):
 * aktiv = accentMuted-Füllung mit accent-Rand.
 *
 * Anders als die React-Native-Fassung, die ein `Pressable` mit
 * handgemachtem Häkchen war, steckt hier ein echtes
 * `<input type="checkbox">` in einem `<label>`. Das bringt Tastaturbedienung,
 * Label-Zuordnung, `:checked`, `:disabled` und die Rolle für Screenreader
 * mit, ohne dass ein einziges ARIA-Attribut nötig wäre — das Element IST die
 * Semantik. Sichtbar ist die gestylte Box daneben, das Input selbst liegt
 * darunter (siehe `.input` im Modul).
 */
export function Checkbox({ label, checked, onChange, disabled, hint }: CheckboxProps) {
  return (
    <label className={styles.row}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        ✓
      </span>
      <span className={styles.textColumn}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}

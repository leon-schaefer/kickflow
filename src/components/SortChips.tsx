import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './SortChips.module.css';

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
 * Markt-Tab.
 *
 * Die beiden `minHeight: 50` aus der RN-Fassung sind ersatzlos weg: sie waren
 * Gegenmittel gegen einen Messfehler von RNs horizontaler ScrollView (die
 * Content-Höhe wurde zu klein gemessen, sobald wirklich gescrollt werden
 * musste, und die Chips verloren ihr Padding). Ein Scroll-Container im
 * Browser misst das selbst.
 *
 * Der aktive Chip trägt `aria-pressed`, nicht `role="radio"`: eine echte
 * radiogroup verlangt Pfeiltasten-Navigation mit wanderndem tabindex.
 */
export function SortChips<K extends string>({ options, value, onChange, leading }: SortChipsProps<K>) {
  return (
    <div className={cx(styles.scroll, layout.noScrollbar)}>
      <div className={styles.row}>
        {leading}
        {options.map((option) => (
          <div key={option.key} className={styles.entry}>
            {option.dividerBefore && <SortChipsDivider />}
            <button
              type="button"
              aria-pressed={value === option.key}
              className={cx(layout.pressable, styles.chip)}
              onClick={() => onChange(option.key)}
            >
              {option.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SortChipsDivider() {
  return <span className={styles.divider} />;
}

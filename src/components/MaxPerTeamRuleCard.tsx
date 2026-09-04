import { Checkbox } from '@/components/Checkbox';
import type { MaxPerTeamRule } from '@/lineup/rules';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './MaxPerTeamRuleCard.module.css';

const QUICK_VALUES = [1, 2, 3, 4, 5];

interface MaxPerTeamRuleCardProps {
  rule: MaxPerTeamRule;
  onChange: (patch: Partial<MaxPerTeamRule>) => void;
  /** Kickbases eigener Wert für diese Liga (`overview.mpst`), nur für den Hinweistext. */
  leagueMax: number | null;
}

/**
 * Checkbox + Wert-Chips für die maxPerTeam-Regel — aus rules.tsx herausgezogen,
 * damit die Karte identisch im Regel-Screen UND im Liga-Tab (league.tsx)
 * erscheint, statt zweimal denselben Code zu pflegen. Beide Aufrufer nutzen
 * `useLeagueRulesContext()`, der State ist also ohnehin geteilt (siehe dort).
 */
export function MaxPerTeamRuleCard({ rule, onChange, leagueMax }: MaxPerTeamRuleCardProps) {
  const hintParts = [
    rule.enabled
      ? 'Gilt für jeden Verein gleich — der Optimizer hält sich immer daran.'
      : 'Regel ist aus — der Optimizer ignoriert sie.',
  ];
  if (leagueMax !== null && leagueMax !== rule.max) {
    hintParts.push(`Kickbase erlaubt in dieser Liga max. ${leagueMax} pro Verein.`);
  }

  return (
    <div className={styles.card}>
      <Checkbox
        label="Max. Spieler pro Verein"
        checked={rule.enabled}
        onChange={(enabled) => onChange({ enabled })}
        hint={hintParts.join(' ')}
      />
      {/*
        aria-pressed und nicht role="radio": eine echte radiogroup verlangt
        Pfeiltasten-Navigation mit wanderndem tabindex, und eine halb erfüllte
        ARIA-Zusage ist schlechter als eine Reihe Toggle-Buttons. Der aktive
        Wert ist so trotzdem hörbar — vorher trug der Chip gar keinen Zustand.
      */}
      <div className={styles.chipRow} role="group" aria-label="Max. Spieler pro Verein">
        {QUICK_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rule.max === value}
            className={cx(layout.pressable, styles.chip)}
            onClick={() => onChange({ max: value })}
            disabled={!rule.enabled}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

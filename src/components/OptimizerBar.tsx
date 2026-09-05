import type { Position } from '@/api/kickbase';
import { describeRule, type LineupRule } from '@/lineup/rules';
import type { OptimizerDiff } from '@/lineup/useLineupOptimizer';
import { positionLabels } from '@/theme/tokens';
import { formatCurrency, formatPoints, formatValueScore } from '@/utils/format';
import type { OptimizationResult, OptimizerMetric } from '@/utils/lineupOptimizer';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './OptimizerBar.module.css';
import { Checkbox } from './Checkbox';

const METRIC_OPTIONS: { key: OptimizerMetric; label: string }[] = [
  { key: 'valuePerMillion', label: 'Ø-Punkte/Mio' },
  { key: 'points', label: 'Ø-Punkte' },
  { key: 'expectedPoints', label: 'Erwartete Punkte' },
];

interface OptimizerBarProps {
  metric: OptimizerMetric;
  onChangeMetric: (metric: OptimizerMetric) => void;
  result: OptimizationResult;
  /** Eingefroren zum Zeitpunkt des letzten "Optimieren" — null, solange noch nicht übernommen. */
  appliedDiff: OptimizerDiff | null;
  onApply: () => void;
  onReset: () => void;
  /** "Konto ausgleichen" — siehe useLineupOptimizer.sellPlan/utils/sellPlan.ts. */
  balanceBudget: boolean;
  onChangeBalanceBudget: (value: boolean) => void;
  /** Fehlbetrag aus useBudgetLimit — 0 oder negativ, wenn das Konto im Plus ist. */
  deficit: number;
  /** Liga-eigene Optimizer-Regeln, für die Zusammenfassungszeile und den Blocker-Hinweis. */
  rules: readonly LineupRule[];
  onOpenRules: () => void;
  /** Einmalig für diese Optimierung ignorieren, wenn eine Regel keine Elf mehr zulässt. */
  onIgnoreRule: (id: LineupRule['id']) => void;
  /** Regeln, die die aktuelle (manuell bearbeitete) Elf verletzen — informativ, der Optimizer bindet nur sich selbst. */
  draftViolations: readonly LineupRule[];
}

function formatScore(score: number, metric: OptimizerMetric): string {
  return metric === 'valuePerMillion'
    ? `Ø ${formatValueScore(score)} Pkt/Mio`
    : `Ø ${formatPoints(Math.round(score))} Pkt`;
}

/** Formationswahl + Zielmetrik + "Konto ausgleichen" für den Aufstellungs-Optimizer. Nur im Edit-Modus sichtbar. */
export function OptimizerBar({
  metric,
  onChangeMetric,
  result,
  appliedDiff,
  onApply,
  onReset,
  balanceBudget,
  onChangeBalanceBudget,
  deficit,
  rules,
  onOpenRules,
  onIgnoreRule,
  draftViolations,
}: OptimizerBarProps) {
  const { best } = result;
  const activeRules = rules.filter((rule) => rule.enabled);
  const blockedRules = rules.filter((rule) => result.blockedRuleIds.includes(rule.id));

  return (
    <div className={styles.container}>
      <button type="button" className={cx(layout.pressableH, styles.rulesRow)} onClick={onOpenRules}>
        <span className={styles.rulesText}>
          {activeRules.length > 0
            ? `Regeln: ${activeRules.map(describeRule).join(', ')}`
            : 'Keine Regeln aktiv'}
        </span>
        <span className={styles.rulesChevron} aria-hidden="true">
          ›
        </span>
      </button>

      <Checkbox
        label="Konto ausgleichen"
        checked={balanceBudget}
        onChange={onChangeBalanceBudget}
        disabled={deficit <= 0}
        hint={
          deficit <= 0
            ? 'Konto ist im Plus — kein Ausgleich nötig.'
            : `Kontostand ${formatCurrency(-deficit)} — bezieht nötige Verkäufe in die Optimierung ein.`
        }
      />

      <div className={styles.metricRow} role="group" aria-label="Zielmetrik">
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={metric === option.key}
            className={cx(layout.pressable, styles.metricChip)}
            onClick={() => onChangeMetric(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={cx(layout.pressable, styles.applyButton)}
          onClick={onApply}
          disabled={!best}
        >
          Optimieren
        </button>
        <div className={styles.resultInfo}>
          {best ? (
            <span className={styles.resultText}>
              Beste Formation {best.formation} · {formatScore(best.score!, metric)}
            </span>
          ) : blockedRules.length === 0 ? (
            <>
              <span className={styles.resultTextMuted}>Keine Formation besetzbar.</span>
              {result.ranking[0] && (
                <span className={styles.resultTextMuted}>
                  {missingLabel(result.ranking[0].missing)}
                </span>
              )}
            </>
          ) : null}
        </div>
      </div>

      {!best && blockedRules.length > 0 && (
        <div className={styles.blockerBox}>
          {blockedRules.map((rule) => (
            <div key={rule.id} className={styles.blockerRow}>
              <span className={styles.blockerText}>
                <span aria-hidden="true">⚠</span> Blockiert von: {describeRule(rule)}
              </span>
              <button
                type="button"
                className={cx(layout.pressable, styles.ignoreButton)}
                onClick={() => onIgnoreRule(rule.id)}
              >
                Regel für diese Optimierung ignorieren
              </button>
            </div>
          ))}
        </div>
      )}

      {metric === 'valuePerMillion' && (
        <p className={styles.hint}>
          Maximiert Effizienz, nicht Punkte — die Elf ist bewusst günstig.
        </p>
      )}

      {metric === 'expectedPoints' && (
        <p className={styles.hint}>
          Ø-Punkte gewichtet mit der Gegner-Härte der nächsten Spiele — Angreifer/Mittelfeld nach
          gegnerischer Abwehr, Abwehr/Torwart nach gegnerischem Angriff. Grobe Tendenz, kein
          kalibriertes Vorhersagemodell.
        </p>
      )}

      {draftViolations.length > 0 && (
        <p className={styles.violationHint}>
          Deine aktuelle Elf verletzt: {draftViolations.map(describeRule).join(', ')}
        </p>
      )}

      {appliedDiff && (
        <div className={styles.diffRow}>
          <span className={styles.diffText}>
            {appliedDiff.changeCount > 0
              ? `${appliedDiff.changeCount} Wechsel gegenüber deiner Elf.`
              : 'Keine Änderung — deine Elf ist bereits optimal.'}
          </span>
          <button
            type="button"
            className={cx(layout.pressable, styles.resetButton)}
            onClick={onReset}
          >
            Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}

function missingLabel(missing: Partial<Record<Position, number>>): string {
  const parts = (Object.keys(missing) as (keyof typeof missing)[]).map(
    (position) => `${missing[position]} ${positionLabels[position]}`,
  );
  return parts.length > 0 ? `Es fehlen ${parts.join(', ')}.` : '';
}

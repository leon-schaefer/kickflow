import { useId, useState } from 'react';
import type { BudgetLimit } from '@/utils/budget';
import { formatCurrency } from '@/utils/format';
import styles from './BudgetBar.module.css';

interface BudgetBarProps {
  limit: BudgetLimit;
}

/**
 * Zeigt den 33%-Überziehungsrahmen (utils/budget.ts) über der Transfermarkt-
 * Liste. Zugeklappt steht dort nur, was für ein neues Gebot noch da ist — die
 * Bestandteile dahinter (Kontostand, offene Gebote, Rahmen) kommen erst beim
 * Antippen dazu, damit die Zeile über der Liste nicht dauerhaft Platz kostet.
 * Die Überziehungs-Warnung bleibt auch zugeklappt stehen: ohne sie sähe ein
 * `available` von 0 € wie ein leeres Konto statt wie ein Verkaufszwang aus.
 */
export function BudgetBar({ limit }: BudgetBarProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.row}
        onClick={() => setExpanded((value) => !value)}
        // Vorher accessibilityState={{ expanded }}. Der accessibilityHint
        // („Zeigt Konto, offene Gebote und Rahmen.") entfällt: aria-expanded
        // sagt schon, dass sich hier etwas auf- und zuklappt, und
        // aria-controls zeigt worauf.
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <span className={styles.label}>Verfügbar</span>
        <span className={styles.valueGroup}>
          <span className={styles.value}>{formatCurrency(limit.available)}</span>
          <span className={styles.chevron} aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
        </span>
      </button>

      {expanded && (
        <div className={styles.details} id={detailsId}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Konto</span>
            <span className={styles.detailValue}>{formatCurrency(limit.budget)}</span>
          </div>
          {limit.pendingOffers > 0 && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>In offenen Geboten</span>
              <span className={styles.detailValue}>{formatCurrency(limit.pendingOffers)}</span>
            </div>
          )}
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Rahmen</span>
            <span className={styles.detailValue}>{formatCurrency(limit.overdraftAllowance)}</span>
          </div>
        </div>
      )}

      {limit.overLimit && (
        <p className={styles.warning}>
          Kader bereits über der 33%-Grenze — Verkäufe nötig, bevor neue Gebote zählen.
        </p>
      )}
    </div>
  );
}

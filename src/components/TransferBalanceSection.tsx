import { useId, useState } from 'react';
import type { TransferSpell, TransferSummary } from '@/stats/transferBalance';
import { cx } from '@/utils/cx';
import { formatCurrency, formatDelta, formatIsoDate } from '@/utils/format';
import layout from '@/theme/layout.module.css';
import styles from './TransferBalanceSection.module.css';

interface Props {
  /** Eigene Besitzzeiträume, größter Gewinn zuerst (siehe buildTransferSpells). */
  spells: readonly TransferSpell[];
  summary: TransferSummary;
  /** Noch laufende Historien-Requests, für den Ladehinweis über der Liste. */
  pending?: number;
  /**
   * false = ohne eigene User-ID lässt sich kein Kauf zuordnen (siehe
   * transferBalance.ts). Dann steht statt einer leeren Liste der Grund da.
   */
  attributable?: boolean;
  /**
   * Meldet das Auf-/Zuklappen nach oben. Die Historie kostet einen Request pro
   * Spieler — der Screen hängt daran, ob er sie überhaupt abschickt (Vorbild
   * SellAdviceSection).
   */
  onExpandedChange?: (expanded: boolean) => void;
  onSelectPlayer?: (playerId: string) => void;
}

/**
 * „Größter Transfergewinn, größter Reinfall" — die zweite Hälfte der
 * Statistik, als eigene Sektion und standardmäßig ZUGEKLAPPT: sie kostet
 * einen Request je Spieler, den je besessen hat, und die Punktequellen
 * darüber sind die Antwort, für die man den Screen öffnet.
 *
 * Reines Anzeige-Bauteil ohne Query- und Auth-Kontext, wie alles in diesem
 * Ordner — gerechnet wird in src/stats/transferBalance.ts.
 */
export function TransferBalanceSection({
  spells,
  summary,
  pending = 0,
  attributable = true,
  onExpandedChange,
  onSelectPlayer,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
  }

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={cx(layout.pressableH, styles.header)}
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <span className={styles.headerText}>
          <span className={styles.title}>Transferbilanz</span>
          <span className={styles.subtitle}>
            {expanded
              ? 'Was deine Käufe und Verkäufe eingebracht haben'
              : 'Größter Gewinn, größter Reinfall — lädt beim Aufklappen'}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {expanded ? '▾' : '›'}
        </span>
      </button>

      {expanded && (
        <div id={listId} className={styles.body}>
          {!attributable ? (
            <p className={styles.hint}>
              Ohne deine Kickbase-Nutzerkennung lässt sich kein Kauf dir zuordnen. Einmal abmelden
              und neu anmelden genügt.
            </p>
          ) : (
            <>
              {pending > 0 && (
                <p className={styles.hint} role="status">
                  Transferhistorie wird geladen — noch {pending} Spieler.
                </p>
              )}

              <div className={styles.totals}>
                <Total label="Realisiert" value={summary.realizedProfit} />
                <Total label="Auf Kaderspieler" value={summary.openProfit} />
              </div>
              <p className={styles.hint}>
                Realisiert zählt nur abgeschlossene Verkäufe ({summary.realizedCount}). Der zweite
                Wert ist ein Buchgewinn gegen den heutigen Marktwert — eingelöst ist er erst beim
                Verkauf.
              </p>

              {spells.length === 0 ? (
                <p className={styles.empty}>
                  {pending > 0
                    ? 'Noch nichts ausgewertet.'
                    : 'Noch kein belegbarer eigener Transfer.'}
                </p>
              ) : (
                <ul className={styles.list}>
                  {spells.map((spell) => (
                    <li key={`${spell.playerId}-${spell.buyDate}`}>
                      <SpellRow spell={spell} onSelect={onSelectPlayer} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.total}>
      <span className={styles.totalLabel}>{label}</span>
      <span className={styles.totalValue} data-sign={sign(value)}>
        {formatDelta(value)}
      </span>
    </span>
  );
}

/** `data-sign` statt einer Klasse: dieselbe Idiomatik wie `data-position` (siehe theme/positions.css). */
function sign(value: number): 'positive' | 'negative' | 'neutral' {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function SpellRow({
  spell,
  onSelect,
}: {
  spell: TransferSpell;
  onSelect?: (playerId: string) => void;
}) {
  const bought = formatIsoDate(spell.buyDate);
  const sold = spell.sellDate ? formatIsoDate(spell.sellDate) : null;

  const content = (
    <>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{spell.name}</span>
        <span className={styles.rowMeta}>
          {formatCurrency(spell.buyPrice)}
          {bought ? ` am ${bought}` : ''} →{' '}
          {spell.realized
            ? `${formatCurrency(spell.sellPrice ?? 0)}${sold ? ` am ${sold}` : ''}`
            : `heute ${formatCurrency(spell.buyPrice + spell.profit)}`}
        </span>
      </span>
      <span className={styles.rowProfit} data-sign={sign(spell.profit)}>
        {formatDelta(spell.profit)}
        {!spell.realized && <span className={styles.rowOpen}>offen</span>}
      </span>
    </>
  );

  if (!onSelect) return <span className={styles.row}>{content}</span>;

  return (
    <button
      type="button"
      className={cx(layout.pressableH, styles.row)}
      onClick={() => onSelect(spell.playerId)}
    >
      {content}
    </button>
  );
}

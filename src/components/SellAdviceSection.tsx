import { useId, useState } from 'react';
import type { SquadPlayer } from '@/api/kickbase';
import { formatCurrency } from '@/utils/format';
import type { SellAdvice } from '@/utils/sellAdvice';
import type { SellPlan } from '@/utils/sellPlan';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './SellAdviceSection.module.css';
import { SellAdviceRow } from './SellAdviceRow';

interface SellAdviceSectionProps {
  players: SquadPlayer[];
  advice: SellAdvice[];
  budget: number | null;
  /** Pflichtverkaufsplan bei negativem Konto — null, wenn das Konto im Plus ist. Siehe utils/sellPlan.ts. */
  plan: SellPlan | null;
  onSelectPlayer?: (player: SquadPlayer) => void;
  /** Spieler vom Verkauf ausschließen/freigeben — ohne Handler bleiben die Zeilen ohne Umschalter. */
  onToggleExcluded?: (player: SquadPlayer) => void;
}

/** "1 Pflichtverkauf" / "2 Pflichtverkäufe" — der Plural ändert hier den Stamm. */
function forcedLabel(count: number): string {
  return count === 1 ? '1 Pflichtverkauf' : `${count} Pflichtverkäufe`;
}

/**
 * Kaufen/Verkaufen-Einordnung des gesamten Kaders. Steht unabhängig vom
 * Edit-Modus zur Verfügung — die Analyse soll auch nach der Aufstellungs-
 * Deadline verfügbar sein. Standardmäßig zugeklappt, damit die Save-Bar im
 * Edit-Modus nicht aus dem Bild rutscht; die Kontoausgleichs-Zeile steht
 * deshalb in der Kopfzeile und nicht in der Liste.
 */
export function SellAdviceSection({
  players,
  advice,
  budget,
  plan,
  onSelectPlayer,
  onToggleExcluded,
}: SellAdviceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const playersById = new Map(players.map((p) => [p.id, p]));

  // Bewusst weiter nur 'verkaufen': Pflichtverkäufe haben ihre eigene Zeile und
  // sollen den Zähler der sportlichen Verkaufskandidaten nicht still schrumpfen.
  // Ausgeschlossene tragen 'ausgeschlossen' und fallen damit von selbst heraus.
  const sellEntries = advice.filter((a) => a.recommendation === 'verkaufen');
  const tiedUpValue = sellEntries.reduce(
    (sum, a) => sum + (playersById.get(a.playerId)?.marketValue ?? 0),
    0,
  );
  const excludedCount = advice.filter((a) => a.excluded).length;
  const forcedCount = plan?.sell.length ?? 0;
  const showBalanceLine = plan !== null && (forcedCount > 0 || !plan.feasible);

  // SellAdviceRow kennt nur die strukturelle SellAdviceRowPlayer-Teilmenge —
  // hier über die id wieder auf den vollständigen SquadPlayer auflösen.
  function handleSelect(id: string) {
    const player = playersById.get(id);
    if (player) onSelectPlayer?.(player);
  }

  function handleToggleExcluded(id: string) {
    const player = playersById.get(id);
    if (player) onToggleExcluded?.(player);
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={cx(layout.pressableV, styles.header)}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <span className={styles.title}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> Kaufen &amp; Verkaufen (
          {advice.length})
        </span>
        {showBalanceLine && plan && (
          <span className={plan.feasible ? styles.summary : styles.warning}>
            {plan.feasible
              ? `Kontoausgleich: ${forcedLabel(forcedCount)} · Erlös ${formatCurrency(plan.proceeds)} → Konto ${formatCurrency(plan.balanceAfter)}`
              : forcedCount > 0
                ? `Kontoausgleich unvollständig: ${forcedLabel(forcedCount)} · es fehlen weiterhin ${formatCurrency(plan.shortfall)}`
                : `Kontoausgleich nicht möglich — es fehlen ${formatCurrency(plan.shortfall)}.`}
          </span>
        )}
        {/* Nur bei ungedecktem Fehlbetrag: dann ist der Ausschluss eine echte Ursache und keine Randnotiz. */}
        {showBalanceLine && plan && !plan.feasible && plan.excludedValue > 0 && (
          <span className={styles.summary}>
            {formatCurrency(plan.excludedValue)} stecken in ausgeschlossenen Spielern — Ausschluss
            aufheben, um sie einzuplanen.
          </span>
        )}
        <span className={styles.summary}>
          {sellEntries.length === 0
            ? 'Keine Verkaufskandidaten'
            : `${sellEntries.length} Verkaufskandidat${sellEntries.length === 1 ? '' : 'en'} · ${formatCurrency(tiedUpValue)} gebunden`}
          {excludedCount > 0 && ` · ${excludedCount} ausgeschlossen`}
          {budget !== null && (
            <>
              {' · Budget '}
              {/*
                Der einzige verschachtelte Text im ganzen Projekt: er muss im
                Fluss der Zeile bleiben, nicht als eigenes Flex-Item daneben.
                Deshalb ist .summary bewusst kein Flex-Container.
              */}
              <span className={budget < 0 ? styles.budgetNegative : undefined}>
                {formatCurrency(budget)}
              </span>
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className={styles.list} id={listId}>
          {/* Derselbe Vorbehalt wie in SellPlanBar — er gehört überall dorthin, wo Erlöse stehen. */}
          {forcedCount > 0 && (
            <p className={styles.disclaimer}>
              Erlös geschätzt zum Marktwert — ein Verkauf an Mitspieler kann darüber liegen.
            </p>
          )}
          {advice.map((entry) => {
            const player = playersById.get(entry.playerId);
            if (!player) return null;
            return (
              <div key={entry.playerId} className={styles.rowWrap}>
                <SellAdviceRow
                  player={player}
                  advice={entry}
                  onClick={(p) => handleSelect(p.id)}
                  onToggleExcluded={onToggleExcluded ? (p) => handleToggleExcluded(p.id) : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

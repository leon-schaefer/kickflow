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
  /**
   * Öffnet den „Auf den Markt stellen"-Dialog für die Pflichtverkäufe. Ohne
   * Handler bleibt die Sektion wie bisher reine Analyse.
   */
  onListOnMarket?: () => void;
  /**
   * playerId → eigener Kaufpreis (siehe usePurchases). Fehlender Eintrag heißt
   * "nicht belegbar" — die Zeile bleibt dann ohne Kaufpreis.
   *
   * Kommt als Prop und wird NICHT hier geholt: die Sektion bleibt damit ein
   * reines Anzeige-Bauteil ohne Query- und Auth-Kontext, so wie alle anderen
   * Komponenten in diesem Ordner. Der Screen entscheidet über `onExpandedChange`
   * unten, wann er die Requests überhaupt startet.
   */
  purchases?: ReadonlyMap<string, number | null>;
  /** Noch laufende Kaufpreis-Requests, für den Ladehinweis über der Liste. */
  purchasesPending?: number;
  /**
   * Meldet das Auf-/Zuklappen nach oben. Der Kaufpreis kostet einen Request pro
   * Spieler — der Screen hängt daran, ob er sie überhaupt abschickt.
   */
  onExpandedChange?: (expanded: boolean) => void;
}

/** "1 Pflichtverkauf" / "2 Pflichtverkäufe" — der Plural ändert hier den Stamm. */
function forcedLabel(count: number): string {
  return count === 1 ? '1 Pflichtverkauf' : `${count} Pflichtverkäufe`;
}

/**
 * Kaufen/Verkaufen-Einordnung des gesamten Kaders, je Zeile mit dem eigenen
 * Kaufpreis und der Differenz zum heutigen Marktwert. Steht unabhängig vom
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
  onListOnMarket,
  purchases,
  purchasesPending = 0,
  onExpandedChange,
}: SellAdviceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const playersById = new Map(players.map((p) => [p.id, p]));

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
  }

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
  // Was vom Plan noch offen ist: schon gelistete Pflichtverkäufe sind erledigt
  // (`SquadPlayer.onMarket` aus der Kader-Antwort) und dürfen den Knopf nicht
  // weiter zu einer Handlung auffordern, die nichts mehr tut.
  const openForcedCount =
    plan?.sell.filter((entry) => !playersById.get(entry.playerId)?.onMarket).length ?? 0;
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
        onClick={toggleExpanded}
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

      {/*
        Bewusst AUSSERHALB der Kopfzeile: die ist selbst ein Button (auf/zu),
        und ein Button darin wäre ungültiges HTML. Bewusst auch außerhalb der
        Liste: der Kontoausgleich ist die dringende Handlung und soll nicht
        erst nach dem Aufklappen erreichbar sein.
      */}
      {onListOnMarket && forcedCount > 0 && (
        <div className={styles.action}>
          {openForcedCount > 0 ? (
            <button
              type="button"
              className={cx(layout.pressable, styles.actionButton)}
              onClick={onListOnMarket}
            >
              {forcedLabel(openForcedCount)} auf den Markt stellen
            </button>
          ) : (
            <p className={styles.actionDone}>Alle Pflichtverkäufe stehen am Markt.</p>
          )}
        </div>
      )}

      {expanded && (
        <div className={styles.list} id={listId}>
          {/* Derselbe Vorbehalt wie in SellPlanBar — er gehört überall dorthin, wo Erlöse stehen. */}
          {forcedCount > 0 && (
            <p className={styles.disclaimer}>
              Erlös geschätzt zum Marktwert — ein Verkauf an Mitspieler kann darüber liegen.
            </p>
          )}
          {purchasesPending > 0 && (
            <p className={styles.disclaimer}>Kaufpreise werden geladen ({purchasesPending}) …</p>
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
                  purchasePrice={purchases?.get(entry.playerId) ?? null}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

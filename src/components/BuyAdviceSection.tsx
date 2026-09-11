import { useId, useState } from 'react';
import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import { describeRule, type LineupRule } from '@/lineup/rules';
import { statusLabels } from '@/theme/tokens';
import { formatCurrency, formatValueScore } from '@/utils/format';
import { describeReplacement, type ReplacementAdvice } from '@/utils/replacementAdvice';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './BuyAdviceSection.module.css';
import { BuyAdviceRow } from './BuyAdviceRow';
import { StatusBadge } from './StatusBadge';

interface BuyAdviceSectionProps {
  /** Eigener Kader — löst die Namen der Ausfälle und der Verdrängten auf. */
  players: SquadPlayer[];
  /** Der Transfermarkt der Liga — löst die IDs der Empfehlungen auf. */
  market: MarketPlayer[];
  advice: ReplacementAdvice;
  /**
   * true, solange die Markt-Query noch keine Daten hat. Ohne das Flag wäre der
   * leere Markt während des Ladens nicht von einem wirklich leeren zu
   * unterscheiden — und „kein Spieler am Transfermarkt" ist dann eine falsche
   * Aussage, keine vorläufige.
   */
  marketPending?: boolean;
  /**
   * Die Liga-Regeln (inkl. deaktivierter, siehe src/lineup/rules.ts) — nur um
   * einen von einer Regel blockierten Kandidaten zu BENENNEN. Die Regel wirkt
   * längst, bevor diese Liste entsteht: der Optimizer rechnet unter ihr
   * (`ReplacementAdvice.blockedByRule`).
   */
  rules?: readonly LineupRule[];
  /** Führt zum Regel-Screen. Ohne Handler bleibt der Hinweis ohne Ausweg. */
  onOpenRules?: () => void;
  onSelectPlayer?: (player: MarketPlayer) => void;
  /** Öffnet den Gebots-Dialog. Ohne Handler bleibt die Sektion reine Analyse. */
  onBid?: (player: MarketPlayer) => void;
}

/** „1 Ausfall" / „2 Ausfälle" — der Plural ändert hier den Stamm. */
function gapLabel(count: number): string {
  return count === 1 ? '1 Ausfall' : `${count} Ausfälle`;
}

function blockedLabel(count: number): string {
  return count === 1 ? '1 Spieler wird' : `${count} Spieler werden`;
}

/**
 * Wie viele blockierte Kandidaten namentlich in der Liste stehen. Ein Markt
 * mit acht Listings desselben Vereins würde die Sektion sonst überschwemmen —
 * und der Hinweis will die Regel erklären, nicht sie widerlegen.
 */
const BLOCKED_SHOWN = 3;

/**
 * Die Kaufseite des Optimizers: welche Ausfälle im Kader wehtun, wer sie vom
 * Markt ersetzen kann und was dafür zu bieten ist (siehe
 * utils/replacementAdvice.ts und utils/bidAdvice.ts).
 *
 * Gegenstück zu SellAdviceSection und mit derselben Mechanik (Kopfzeile als
 * Umschalter, Liste darunter), aber mit einer wichtigen Abweichung: die
 * Empfehlung steht schon in der ZUGEKLAPPTEN Kopfzeile. Anders als der
 * Kaufpreis in der Verkaufsliste kostet sie keine Requests (siehe
 * useReplacementAdvice.ts), und ein Ausfall am Spieltag ist die dringendste
 * Nachricht, die dieser Screen hat — die soll man nicht erst aufklappen
 * müssen.
 */
export function BuyAdviceSection({
  players,
  market,
  advice,
  marketPending = false,
  rules = [],
  onOpenRules,
  onSelectPlayer,
  onBid,
}: BuyAdviceSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const squadById = new Map(players.map((p) => [p.id, p]));
  const marketById = new Map(market.map((p) => [p.id, p]));
  const nameById = (id: string) => squadById.get(id)?.name ?? marketById.get(id)?.name;

  const best = advice.bestGainId ? marketById.get(advice.bestGainId) : undefined;
  const bestOption = advice.options.find((option) => option.playerId === advice.bestGainId);
  const urgentGaps = advice.gaps.filter((gap) => gap.breaksLineup || gap.loss > 0);

  // Die Regeln, die tatsächlich einen Kandidaten aus der Elf halten — nicht
  // alle aktiven. Dieselbe Auflösung ID → Klartext wie in der OptimizerBar.
  const blockingRuleIds = new Set(advice.blockedByRule.flatMap((entry) => entry.blockedByRuleIds));
  const blockingRules = rules.filter((rule) => blockingRuleIds.has(rule.id));

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={cx(layout.pressableV, styles.header)}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <span className={styles.title}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> Zukauf &amp; Ersatz (
          {advice.options.length})
        </span>

        {/* Der Anlass zuerst: ohne Ausfall ist ein Zukauf eine Option, mit
            Ausfall eine offene Baustelle. */}
        {urgentGaps.length > 0 && (
          <span className={styles.warning}>
            {gapLabel(urgentGaps.length)} in der Elf
            {advice.totalLoss > 0 && ` · kosten ${formatValueScore(advice.totalLoss)} Ø-Punkte`}
            {!advice.baselineFeasible && ' · Elf derzeit nicht besetzbar'}
          </span>
        )}

        <span className={styles.summary}>
          {best && bestOption
            ? `Bester Ersatz: ${best.name} · +${formatValueScore(bestOption.gain)} Ø-Punkte${
                bestOption.bid.bid === null
                  ? ' · Budget reicht nicht'
                  : // Liegt mein Gebot schon dort, ist „X bieten" eine Aufforderung
                    // zu nichts — dieselbe Unterscheidung wie in BidAdvice.reason.
                    best.ownOfferPrice != null && best.ownOfferPrice >= bestOption.bid.bid
                    ? ` · dein Gebot ${formatCurrency(best.ownOfferPrice)} deckt das`
                    : ` · ${formatCurrency(bestOption.bid.bid)} bieten`
              }`
            : marketPending
              ? 'Transfermarkt wird geladen …'
              : advice.consideredCount === 0
                ? 'Kein einsatzfähiger Spieler am Transfermarkt.'
                : advice.blockedByRule.length > 0
                  ? // Der Fall, in dem Schweigen am meisten verwirrt: es gäbe
                    // einen Zugewinn, nur verbietet ihn eine eigene Regel.
                    `${blockedLabel(advice.blockedByRule.length)} von deinen Regeln aus der Elf gehalten · kein anderer Zukauf verbessert sie.`
                  : `Kein Zukauf verbessert die Elf (${advice.consideredCount} geprüft).`}
        </span>
      </button>

      {expanded && (
        <div className={styles.list} id={listId}>
          <p className={styles.disclaimer}>
            Zugewinn = beste Elf mit ihm minus beste Elf ohne ihn, in Ø-Punkten. Das empfohlene
            Gebot ist eine Schätzung mit Aufschlag nach Augenmaß — Kickbase nennt keine
            Zuschlagsgrenze.
          </p>

          {advice.gaps.length > 0 && (
            <div className={styles.gaps}>
              {advice.gaps.map((gap) => {
                const player = squadById.get(gap.playerId);
                if (!player) return null;
                return (
                  <p key={gap.playerId} className={styles.gapRow}>
                    <StatusBadge status={player.status} />
                    <span className={styles.gapName}>{player.name}</span>
                    <span className={styles.gapNote}>
                      {gap.breaksLineup
                        ? 'Elf ohne ihn nicht besetzbar'
                        : gap.loss > 0
                          ? `kostet ${formatValueScore(gap.loss)} Ø-Punkte`
                          : 'ohne Folgen — die Bank fängt ihn auf'}
                      {` · ${statusLabels[player.status]}`}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {advice.options.length === 0 ? (
            <p className={styles.empty}>
              {marketPending
                ? 'Transfermarkt wird geladen …'
                : advice.consideredCount === 0
                  ? 'Am Transfermarkt steht gerade kein einsatzfähiger Spieler.'
                  : advice.blockedByRule.length > 0
                    ? 'Kein gelisteter Spieler würde die Elf verbessern, solange deine Regeln gelten.'
                    : 'Keiner der gelisteten Spieler würde die Elf verbessern.'}
            </p>
          ) : (
            advice.options.map((option) => {
              const player = marketById.get(option.playerId);
              if (!player) return null;
              return (
                <div key={option.playerId} className={styles.rowWrap}>
                  <BuyAdviceRow
                    player={player}
                    option={option}
                    note={describeReplacement(option, nameById)}
                    bestGain={option.playerId === advice.bestGainId}
                    bestEfficiency={option.playerId === advice.bestEfficiencyId}
                    onClick={onSelectPlayer ? () => onSelectPlayer(player) : undefined}
                    onBid={onBid ? () => onBid(player) : undefined}
                  />
                </div>
              );
            })
          )}

          {/*
            Kein Vorschlag, sondern eine Erklärung: die Regel ist hart, und ein
            Spieler, der nicht spielen darf, bringt keine Punkte. Ohne diesen
            Block fehlte der beste Stürmer der Liga kommentarlos in der Liste.
          */}
          {advice.blockedByRule.length > 0 && (
            <div className={styles.blocked}>
              <p className={styles.blockedTitle}>
                {blockingRules.length > 0
                  ? `${blockingRules.map(describeRule).join(', ')} — deshalb nicht empfohlen:`
                  : 'Von einer aktiven Liga-Regel aus der Elf gehalten:'}
              </p>
              {advice.blockedByRule.slice(0, BLOCKED_SHOWN).map((entry) => {
                const player = marketById.get(entry.playerId);
                if (!player) return null;
                return (
                  <p key={entry.playerId} className={styles.blockedRow}>
                    <span className={styles.blockedName}>{player.name}</span>
                    <span className={styles.gapNote}>
                      +{formatValueScore(entry.gainWithoutRule)} Ø-Punkte ohne die Regel ·{' '}
                      {formatCurrency(player.price)}
                    </span>
                  </p>
                );
              })}
              {advice.blockedByRule.length > BLOCKED_SHOWN && (
                <p className={styles.blockedRow}>
                  <span className={styles.gapNote}>
                    und {advice.blockedByRule.length - BLOCKED_SHOWN} weitere
                  </span>
                </p>
              )}
              {onOpenRules && (
                <button
                  type="button"
                  className={cx(layout.pressable, styles.blockedAction)}
                  onClick={onOpenRules}
                >
                  Regeln ansehen ›
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

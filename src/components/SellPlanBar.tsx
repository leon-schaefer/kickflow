import type { SquadPlayer } from '@/api/kickbase';
import { formatCurrency, formatPoints, formatValueScore } from '@/utils/format';
import type { OptimizerMetric } from '@/utils/lineupOptimizer';
import type { SellPlan } from '@/utils/sellPlan';
import styles from './SellPlanBar.module.css';

interface SellPlanBarProps {
  players: readonly SquadPlayer[];
  plan: SellPlan | null;
  metric: OptimizerMetric;
}

function formatScoreLoss(scoreLoss: number, metric: OptimizerMetric): string {
  if (scoreLoss <= 0) return 'ohne Punkteverlust';
  return metric === 'valuePerMillion'
    ? `−${formatValueScore(scoreLoss)} Pkt/Mio gegenüber der freien Elf`
    : `−${formatPoints(Math.round(scoreLoss))} Pkt gegenüber der freien Elf`;
}

/**
 * Ergebnis der "Konto ausgleichen"-Option (die Checkbox selbst sitzt in
 * OptimizerBar, bei den übrigen Optimierungs-Einstellungen). `plan` ist nur
 * gesetzt, wenn die Checkbox aktiv UND ein Defizit vorhanden ist
 * (useLineupOptimizer) — hier also keine eigene enabled/deficit-Prüfung nötig.
 */
export function SellPlanBar({ players, plan, metric }: SellPlanBarProps) {
  if (!plan) return null;

  const playersById = new Map(players.map((p) => [p.id, p]));

  return (
    <div className={styles.container}>
      {plan.sell.length > 0 && (
        <ul className={styles.list}>
          {plan.sell.map((entry) => {
            const player = playersById.get(entry.playerId);
            return (
              <li key={entry.playerId} className={styles.row}>
                <span className={styles.rowName}>{player?.name ?? entry.playerId}</span>
                <span className={styles.rowValue}>{formatCurrency(entry.marketValue)}</span>
                <span className={styles.rowTag}>{entry.wasInBestXi ? 'aus der Elf' : 'Bank'}</span>
              </li>
            );
          })}
        </ul>
      )}

      {plan.feasible ? (
        <>
          <p className={styles.summary}>
            Erlös {formatCurrency(plan.proceeds)} → Konto {formatCurrency(plan.balanceAfter)}
          </p>
          <p className={styles.hint}>Kosten: {formatScoreLoss(plan.scoreLoss, metric)}</p>
        </>
      ) : plan.shortfall > 0 ? (
        <>
          <p className={styles.warning}>
            Kader deckt den Fehlbetrag nicht — es fehlen {formatCurrency(plan.shortfall)}.
          </p>
          {plan.excludedValue > 0 && (
            <p className={styles.hint}>
              {plan.excludedCount === 1
                ? `1 ausgeschlossener Spieler mit ${formatCurrency(plan.excludedValue)} bleibt unangetastet.`
                : `${plan.excludedCount} ausgeschlossene Spieler mit ${formatCurrency(plan.excludedValue)} bleiben unangetastet.`}
            </p>
          )}
        </>
      ) : (
        <p className={styles.warning}>Nach den nötigen Verkäufen steht keine Elf mehr.</p>
      )}

      <p className={styles.disclaimer}>
        Erlös geschätzt zum Marktwert — ein Verkauf an Mitspieler kann darüber liegen.
      </p>
    </div>
  );
}

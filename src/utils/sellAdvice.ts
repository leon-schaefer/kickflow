import { formatCurrency } from './format';
import { isAvailableForLineup, type OptimizationResult, type OptimizerPlayer } from './lineupOptimizer';

/**
 * Behalten/Verkaufen-Einordnung je Kaderspieler, abgeleitet aus der Differenz
 * zweier Optimierungen (Effizienz vs. Punkte). Die Lücke zwischen beiden
 * Optimal-Elfen ist das eigentliche Signal: wer nur in der Punkte-Elf steht,
 * ist teuer erkauft; wer nur in der Effizienz-Elf steht, ist ein Schnäppchen.
 */
export type SellRecommendation =
  | 'unverzichtbar'
  | 'effizienz-juwel'
  | 'punkte-garant'
  | 'rotation'
  | 'beobachten'
  | 'verkaufen'
  | 'nicht-einsatzbereit';

export interface SellAdvice {
  playerId: string;
  recommendation: SellRecommendation;
  /** Kurzbegründung auf Deutsch, direkt anzeigbar. */
  reason: string;
  inBestEfficiencyXi: boolean;
  inBestPointsXi: boolean;
  inAnyXi: boolean;
  expensive: boolean;
}

export const recommendationLabels: Record<SellRecommendation, string> = {
  unverzichtbar: 'Behalten',
  'effizienz-juwel': 'Preis-Leistung',
  'punkte-garant': 'Punktelieferant',
  rotation: 'Rotation',
  beobachten: 'Beobachten',
  verkaufen: 'Verkaufen',
  'nicht-einsatzbereit': 'Ausfall',
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Leitet für jeden Spieler eine Empfehlung ab. `efficiency` und `points`
 * müssen Ergebnisse von `optimizeLineup` mit den Metriken 'valuePerMillion'
 * bzw. 'points' auf demselben Kader sein.
 */
export function deriveSellAdvice(
  players: readonly OptimizerPlayer[],
  efficiency: OptimizationResult,
  points: OptimizationResult,
): SellAdvice[] {
  const bestEfficiencyIds = new Set(efficiency.best?.playerIds ?? []);
  const bestPointsIds = new Set(points.best?.playerIds ?? []);
  const anyXiIds = new Set([...efficiency.usedInAnyFormation, ...points.usedInAnyFormation]);
  // Median statt fixer Euro-Schwelle: skaliert mit Kadergröße und Liga-Inflation
  // und ist trivial erklärbar ("teurer als dein Kader-Median").
  const medianMarketValue = median(players.map((p) => p.marketValue));

  const advice = players.map((player): SellAdvice => {
    const inBestEfficiencyXi = bestEfficiencyIds.has(player.id);
    const inBestPointsXi = bestPointsIds.has(player.id);
    const inAnyXi = anyXiIds.has(player.id);
    const expensive = player.marketValue >= medianMarketValue;

    // Reihenfolge ist entscheidend: Ausfälle sind aus jeder Elf ausgeschlossen
    // und würden sonst pauschal als "verkaufen" erscheinen (Regel 1 zuerst).
    if (!isAvailableForLineup(player.status)) {
      return {
        playerId: player.id,
        recommendation: 'nicht-einsatzbereit',
        reason: 'Nicht einsatzfähig — für die Optimierung nicht berücksichtigt.',
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    if (inBestEfficiencyXi && inBestPointsXi) {
      return {
        playerId: player.id,
        recommendation: 'unverzichtbar',
        reason: 'Steht in beiden Optimal-Elfen.',
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    if (inBestEfficiencyXi) {
      return {
        playerId: player.id,
        recommendation: 'effizienz-juwel',
        reason: 'Nur in der Punkte/Mio-Elf — günstige Punkte, halten.',
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    if (inBestPointsXi) {
      return {
        playerId: player.id,
        recommendation: 'punkte-garant',
        reason: 'Nur in der Ø-Punkte-Elf — teuer, liefert aber.',
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    if (inAnyXi) {
      return {
        playerId: player.id,
        recommendation: 'rotation',
        reason: 'Nur in alternativen Formationen in der Elf.',
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    if (expensive) {
      return {
        playerId: player.id,
        recommendation: 'verkaufen',
        reason: `In keiner Formation in der Elf und bindet ${formatCurrency(player.marketValue)}.`,
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    return {
      playerId: player.id,
      recommendation: 'beobachten',
      reason: 'In keiner Formation in der Elf, aber günstig.',
      inBestEfficiencyXi,
      inBestPointsXi,
      inAnyXi,
      expensive,
    };
  });

  const order: Record<SellRecommendation, number> = {
    verkaufen: 0,
    beobachten: 1,
    'nicht-einsatzbereit': 2,
    rotation: 3,
    'punkte-garant': 4,
    'effizienz-juwel': 5,
    unverzichtbar: 6,
  };
  const marketValueById = new Map(players.map((p) => [p.id, p.marketValue]));
  return advice.sort((a, b) => {
    const byCategory = order[a.recommendation] - order[b.recommendation];
    if (byCategory !== 0) return byCategory;
    const byValue = marketValueById.get(b.playerId)! - marketValueById.get(a.playerId)!;
    if (byValue !== 0) return byValue;
    return a.playerId.localeCompare(b.playerId);
  });
}

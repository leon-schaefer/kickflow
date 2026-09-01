import { formatCurrency } from './format';
import { isAvailableForLineup, type OptimizationResult, type OptimizerPlayer } from './lineupOptimizer';

/**
 * Behalten/Verkaufen-Einordnung je Kaderspieler, abgeleitet aus der Differenz
 * zweier Optimierungen (Effizienz vs. Punkte). Die Lücke zwischen beiden
 * Optimal-Elfen ist das eigentliche Signal: wer nur in der Punkte-Elf steht,
 * ist teuer erkauft; wer nur in der Effizienz-Elf steht, ist ein Schnäppchen.
 *
 * Über allem steht ein negativer Kontostand: die Spieler aus `forcedSaleIds`
 * (dem Pflichtverkaufsplan aus utils/sellPlan.ts) müssen weg, egal wie gut sie
 * sportlich sind — sie werden als 'pflichtverkauf' ganz oben einsortiert.
 */
export type SellRecommendation =
  | 'pflichtverkauf'
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
  pflichtverkauf: 'Pflichtverkauf',
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
  /** Pflichtverkäufe in Auswahlreihenfolge — `SellPlan.sell[].playerId`, siehe utils/sellPlan.ts. */
  forcedSaleIds: readonly string[] = [],
): SellAdvice[] {
  const bestEfficiencyIds = new Set(efficiency.best?.playerIds ?? []);
  const bestPointsIds = new Set(points.best?.playerIds ?? []);
  const anyXiIds = new Set([...efficiency.usedInAnyFormation, ...points.usedInAnyFormation]);
  // Median statt fixer Euro-Schwelle: skaliert mit Kadergröße und Liga-Inflation
  // und ist trivial erklärbar ("teurer als dein Kader-Median").
  const medianMarketValue = median(players.map((p) => p.marketValue));
  // Map statt Set: der Index ist zugleich die Verkaufsreihenfolge des Plans
  // (nicht Einsatzfähige zuerst, dann die wenigsten Punkte pro Mio) und damit
  // die einzig sinnvolle Sortierung innerhalb der Pflichtverkäufe.
  const forcedOrder = new Map(forcedSaleIds.map((id, index) => [id, index]));

  const advice = players.map((player): SellAdvice => {
    const inBestEfficiencyXi = bestEfficiencyIds.has(player.id);
    const inBestPointsXi = bestPointsIds.has(player.id);
    const inAnyXi = anyXiIds.has(player.id);
    const expensive = player.marketValue >= medianMarketValue;

    // Reihenfolge ist entscheidend. Regel 1 ist der Kontoausgleich: er steht
    // sogar vor der Ausfall-Regel, denn der Plan verkauft nicht einsatzfähige
    // Spieler ZUERST (sie kosten die Restelf nichts) — bliebe
    // 'nicht-einsatzbereit' vorne, wäre der Pflichtverkauf genau im häufigsten
    // Fall unsichtbar. Der Status geht nicht verloren, SellAdviceRow zeigt
    // ohnehin einen StatusBadge.
    if (forcedOrder.has(player.id)) {
      return {
        playerId: player.id,
        recommendation: 'pflichtverkauf',
        reason:
          inBestEfficiencyXi || inBestPointsXi
            ? `Trotz Stammplatz nötig: bringt ${formatCurrency(player.marketValue)} zum Kontoausgleich.`
            : `Für den Kontoausgleich nötig — bringt ${formatCurrency(player.marketValue)}.`,
        inBestEfficiencyXi,
        inBestPointsXi,
        inAnyXi,
        expensive,
      };
    }
    // Ausfälle sind aus jeder Elf ausgeschlossen und würden sonst pauschal als
    // "verkaufen" erscheinen.
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
    pflichtverkauf: 0,
    verkaufen: 1,
    beobachten: 2,
    'nicht-einsatzbereit': 3,
    rotation: 4,
    'punkte-garant': 5,
    'effizienz-juwel': 6,
    unverzichtbar: 7,
  };
  const marketValueById = new Map(players.map((p) => [p.id, p.marketValue]));
  return advice.sort((a, b) => {
    const byCategory = order[a.recommendation] - order[b.recommendation];
    if (byCategory !== 0) return byCategory;
    // Innerhalb der Pflichtverkäufe zählt die Reihenfolge des Plans (die
    // empfohlene Verkaufsreihenfolge), nicht der Marktwert. Beide Seiten sind
    // hier zwangsläufig Pflichtverkäufe und damit in forcedOrder.
    if (a.recommendation === 'pflichtverkauf') {
      return forcedOrder.get(a.playerId)! - forcedOrder.get(b.playerId)!;
    }
    const byValue = marketValueById.get(b.playerId)! - marketValueById.get(a.playerId)!;
    if (byValue !== 0) return byValue;
    return a.playerId.localeCompare(b.playerId);
  });
}

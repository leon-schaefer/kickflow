/**
 * Kennzahlen für Kader- und Marktlisten an einer Stelle — sortieren, formatieren
 * und beschriften ziehen sonst leicht auseinander, sobald eine Kennzahl dazukommt.
 * Reine Helfer, damit sie ohne UI testbar bleiben (Vorbild: playerFilter.ts,
 * marketList.ts).
 */
import type { PlaytimeTotals } from './playtime';
import { pointsPerMinute } from './playtime';
import { formatPoints, formatPointsPerMinute, formatValueScore } from './format';

export type PlayerMetric =
  | 'marketValue'
  | 'totalPoints'
  | 'avgPoints'
  | 'avgPerMillion'
  | 'totalPerMillion'
  | 'pointsPerMinute';

/** Sortier-Modi ohne eigene Kennzahl-Spalte: 'position' gruppiert statt zu sortieren, 'expiry' hat nur der Markt. */
export type PlayerSortKey = PlayerMetric | 'position' | 'expiry';

/** Feldmenge, die SquadPlayer UND MarketPlayer erfüllen — genug für jede Kennzahl hier. */
export interface MetricPlayer {
  marketValue: number;
  /**
   * `null` = die Quelle liefert die Gesamtpunkte nicht. Kader und Markt tragen
   * sie immer, der competition-weite Bestand nie (siehe CompetitionPlayer) —
   * deshalb steht das Loch hier im Typ und nicht als 0 in der Zeile.
   */
  totalPoints: number | null;
  averagePoints: number;
  valueScoreAvg: number;
  valueScoreTotal: number | null;
}

/** Nur 'pointsPerMinute' braucht die Spielminuten aus usePlaytimes. */
export function metricNeedsPlaytime(metric: PlayerMetric): boolean {
  return metric === 'pointsPerMinute';
}

/**
 * Sortierwert, absteigend. Bei 'pointsPerMinute' ohne geladene oder ohne
 * vorhandene Spielzeit 0 — der Spieler landet damit unten, die Liste sortiert
 * sich beim Nachladen nach (gleiches Verhalten wie bisher in value.tsx).
 * Unbekannte Gesamtpunkte (`null`) verhalten sich genauso: 0 zum Sortieren,
 * „—" in der Zelle (siehe formatMetric).
 */
export function metricValue(player: MetricPlayer, metric: PlayerMetric, playtime?: PlaytimeTotals): number {
  switch (metric) {
    case 'marketValue':
      return player.marketValue;
    case 'totalPoints':
      return player.totalPoints ?? 0;
    case 'avgPoints':
      return player.averagePoints;
    case 'avgPerMillion':
      return player.valueScoreAvg;
    case 'totalPerMillion':
      return player.valueScoreTotal ?? 0;
    case 'pointsPerMinute':
      return playtime ? pointsPerMinute(playtime.points, playtime.minutes) : 0;
  }
}

/** Chip-Beschriftung ('Ø-Punkte/Mio') vs. Kurzlabel unter der Zahl in der Zeile ('Ø/Mio') — bewusst getrennt. */
export const metricLabels: Record<PlayerMetric, { chip: string; cell: string }> = {
  marketValue: { chip: 'Marktwert', cell: 'Marktwert' },
  totalPoints: { chip: 'Punkte', cell: 'Punkte' },
  avgPoints: { chip: 'Ø Punkte', cell: 'Ø Punkte' },
  avgPerMillion: { chip: 'Ø-Punkte/Mio', cell: 'Ø/Mio' },
  totalPerMillion: { chip: 'Gesamt-Punkte/Mio', cell: 'Ges/Mio' },
  pointsPerMinute: { chip: 'Punkte/Min', cell: 'P/Min' },
};

/**
 * Anzeigewert für die Statistik-Spalte. "—" statt eines Fake-"0,00" bei
 * 'pointsPerMinute' ohne Einsatzminuten: ohne Spielzeit gibt es kein
 * sinnvolles Verhältnis, und ein "0,00" wäre von echten 0 Punkten nicht zu
 * unterscheiden. Aus demselben Grund "—" bei unbekannten Gesamtpunkten: eine
 * "0" dort behauptet ein Ergebnis, das die Quelle nie geliefert hat.
 */
export function formatMetric(player: MetricPlayer, metric: PlayerMetric, playtime?: PlaytimeTotals): string {
  switch (metric) {
    case 'marketValue':
      // Nur als Fallback relevant (siehe metricForSort) — der Marktwert selbst
      // steht in der Zeile bereits als Anker, hier wird er nicht noch einmal gebraucht.
      return formatPoints(player.averagePoints);
    case 'totalPoints':
      return player.totalPoints === null ? '—' : formatPoints(player.totalPoints);
    case 'avgPoints':
      return formatPoints(player.averagePoints);
    case 'avgPerMillion':
      return formatValueScore(player.valueScoreAvg);
    case 'totalPerMillion':
      return player.valueScoreTotal === null ? '—' : formatValueScore(player.valueScoreTotal);
    case 'pointsPerMinute':
      return playtime && playtime.minutes > 0
        ? formatPointsPerMinute(pointsPerMinute(playtime.points, playtime.minutes))
        : '—';
  }
}

/**
 * Welche Kennzahl-Spalte zu einem Sortier-Schlüssel gehört. 'position' und
 * 'expiry' haben keine eigene Zelle unter den sechs Kennzahlen — 'expiry'
 * zeigt die Restlaufzeit bereits separat neben dem Spielernamen — und fallen
 * auf `fallback` zurück.
 */
export function metricForSort(key: PlayerSortKey, fallback: PlayerMetric): PlayerMetric {
  if (key === 'position' || key === 'expiry') return fallback;
  return key;
}

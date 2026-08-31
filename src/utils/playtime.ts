/**
 * "Punkte pro echter Spielminute" — die Effizienzkennzahl, die `averagePoints`
 * (Punkte pro SPIELTAG) nicht liefern kann: dort zählt ein 10-Minuten-Joker
 * genauso wie ein Durchspieler.
 *
 * Datenquelle sind bewusst die Spieltage aus `/performance`
 * (`MatchdayPerformance.points` / `.minutesPlayed`) und NICHT
 * `PlayerDetail.totalPoints` / `.secondsPlayed`. Gegen einen echten Account
 * geprüft (31.08.2026): `sec` liefert die Detail-Antwort NIE, und `tp` lässt
 * sie bei Spielern ohne Punkte komplett weg (Kickbase spart 0-Werte aus, siehe
 * scripts/.probe-output/player-detail.json). Minuten brauchen wir ohnehin nur
 * aus `mp` — dann kommen beide Summanden aus derselben, verlässlichen Quelle.
 */
import type { MatchdayPerformance, SeasonPerformance } from '@/api/kickbase';

export interface PlaytimeTotals {
  /** Summe der Punkte aller bereits ausgetragenen Spieltage. */
  points: number;
  /** Summe der gespielten Minuten aller bereits ausgetragenen Spieltage. */
  minutes: number;
}

export const EMPTY_PLAYTIME: PlaytimeTotals = { points: 0, minutes: 0 };

/**
 * Die aktuelle Saison ist der LETZTE Eintrag — Kickbase liefert `it`
 * aufsteigend sortiert.
 */
export function latestSeason(performance: SeasonPerformance[]): SeasonPerformance | undefined {
  return performance[performance.length - 1];
}

/**
 * Summiert Punkte und Minuten über alle bereits AUSGETRAGENEN Spieltage.
 * Noch offene Spieltage stehen mit 0/0 in der Antwort und würden das Ergebnis
 * nicht verfälschen — der `hasResult`-Filter macht die Absicht trotzdem
 * explizit (gleiche Idiomatik wie im Spieler-Detail-Screen).
 */
export function sumPlaytime(matchdays: MatchdayPerformance[]): PlaytimeTotals {
  return matchdays.reduce<PlaytimeTotals>(
    (acc, md) =>
      md.hasResult
        ? { points: acc.points + md.points, minutes: acc.minutes + md.minutesPlayed }
        : acc,
    EMPTY_PLAYTIME,
  );
}

/** Punkte pro echter Spielminute. 0 ohne Einsatzzeit — Guard wie in pointsPerMillion. */
export function pointsPerMinute(points: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return points / minutes;
}

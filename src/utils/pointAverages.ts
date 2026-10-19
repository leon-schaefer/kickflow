import type { MatchdaySchedule, PointAverageFields, SeasonPerformance } from '@/api/kickbase/types';
import { pointsPerMillion } from './valueScore';

export interface PointAverages {
  matchdayAverage: number;
  appearanceAverage: number | null;
  matches: number;
  appearances: number;
}

/**
 * Ergebnisse allein belegen kein Abpfeifen: live sind beide Torfelder schon
 * vorhanden, und Kickbases Status-Codes sind unverifiziert. Deshalb erst drei
 * Stunden nach dem tatsächlichen Anstoß werten. Das ist ein konservatives
 * Zeitfenster, kein verifizierter Final-Status (z. B. bei Spielunterbrechung).
 */
export const RESULT_SETTLE_MS = 3 * 60 * 60_000;

/**
 * Nur die im aktuellen Spielplan datierten Spiele der Spielerhistorie zählen.
 * So wird vor Saisonbeginn nie die letzte alte Saison zum aktuellen Schnitt.
 * `pt` muss zu der Paarung gehören; ohne Vereinszuordnung wird kein Nullspiel
 * erfunden. Auch fehlende Historienzeilen werden NICHT aus dem heutigen Verein
 * aufgefüllt: ein Sommer-/Winterzugang gehörte ihm damals womöglich nicht an.
 * Vereinswechsel innerhalb der Competition bleiben über das damalige `pt` drin.
 */
export function pointAverages(
  performance: readonly SeasonPerformance[],
  schedule: MatchdaySchedule | undefined,
  nowMs: number,
): PointAverages | null {
  if (!schedule) return null;
  const fixtures = schedule.matchdays.flatMap((day) =>
    day.fixtures.map((fixture) => ({ ...fixture, day: day.day })),
  );
  let currentSeasonFound = false;
  let points = 0;
  let matches = 0;
  let appearances = 0;
  const seen = new Set<string>();
  for (const season of performance) {
    for (const md of season.matchdays) {
      if (!md.matchDate || !md.playerTeamId ||
          (md.playerTeamId !== md.homeTeamId && md.playerTeamId !== md.awayTeamId)) continue;
      const date = Date.parse(md.matchDate);
      if (!Number.isFinite(date)) continue;
      const fixture = fixtures.find((candidate) =>
        candidate.day === md.matchday && candidate.homeTeamId === md.homeTeamId &&
        candidate.awayTeamId === md.awayTeamId && candidate.kickoffAt &&
        // Die Historie kann nur das Spieldatum statt der exakten Uhrzeit tragen.
        candidate.kickoffAt.slice(0, 10) === md.matchDate!.slice(0, 10),
      );
      if (!fixture?.kickoffAt) continue;
      const kickoff = Date.parse(fixture.kickoffAt);
      if (!Number.isFinite(kickoff)) continue;
      currentSeasonFound = true;
      if (!md.hasResult || !fixture.hasResult || kickoff + RESULT_SETTLE_MS > nowMs) continue;
      const key = `${md.matchday}/${md.homeTeamId}/${md.awayTeamId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches += 1;
      // Fehlende/gerundete Minuten dürfen echte Punkte nicht verschwinden lassen.
      points += md.points;
      if (md.minutesPlayed > 0 || md.points !== 0) appearances += 1;
    }
  }
  if (!currentSeasonFound) return null;
  return {
    matchdayAverage: matches > 0 ? points / matches : 0,
    appearanceAverage: appearances > 0 ? points / appearances : null,
    matches,
    appearances,
  };
}

export function withPointAverages<T extends { averagePoints: number; marketValue: number }>(
  player: T,
  averages: PointAverages,
): T & PointAverageFields {
  const averagePoints = averages.matchdayAverage;
  return {
    ...player,
    averagePoints,
    averagePointsBasis: 'matchdays',
    appearanceAveragePoints: averages.appearanceAverage,
    averageMatchCount: averages.matches,
    appearanceCount: averages.appearances,
    ...('valueScoreAvg' in player ? { valueScoreAvg: pointsPerMillion(averagePoints, player.marketValue) } : {}),
  };
}

/** Kurze Quellenangabe auch während des Ladens, nie stiller Mix der Schnitte. */
export function pointAverageLabel(player: PointAverageFields): string {
  return player.averagePointsBasis === 'matchdays' ? 'Ø/Spieltag' : 'Kickbase-Ø';
}

export function pointAverageNotice(basis: PointAverageFields['averagePointsBasis'], pending = 0): string {
  return basis === 'matchdays'
    ? 'Ø je Spieltag: Spiele ohne Einsatz zählen mit. Grundlage sind die bestätigten Mannschaftsspiele der Spielerhistorie.'
    : pending > 0
      ? 'Spielerhistorien werden geladen. Bis dahin gilt für alle Werte und Empfehlungen der Kickbase-Ø.'
      : 'Spielerhistorien nicht vollständig verfügbar. Alle Werte und Empfehlungen verwenden den Kickbase-Ø.';
}

import type { MatchdayPerformance, MatchdaySchedule } from '@/api/kickbase';

export type MatchOutcome = 'win' | 'draw' | 'loss';

export interface FixtureView {
  isHome: boolean;
  opponentId: string;
  opponentName: string;
  opponentLogoUrl: string | null;
  ownGoals: number;
  opponentGoals: number;
  outcome: MatchOutcome;
}

/**
 * Leitet aus einem `MatchdayPerformance`-Eintrag die Spielersicht ab: welche
 * Seite ist "eigen", wie heißt der Gegner, wer hat gewonnen. `md.playerTeamId`
 * ist auf ausgetragenen Spieltagen immer gesetzt (siehe mappers.ts), der
 * übergebene `fallbackTeamId` (i.d.R. `PlayerDetail.teamId`) greift nur,
 * falls das je nicht der Fall sein sollte.
 */
export function toFixtureView(
  md: MatchdayPerformance,
  fallbackTeamId: string,
  teamNames: Map<string, string>,
): FixtureView {
  const playerTeamId = md.playerTeamId || fallbackTeamId;
  const isHome = playerTeamId === md.homeTeamId;
  const opponentId = isHome ? md.awayTeamId : md.homeTeamId;
  const opponentLogoUrl = isHome ? md.awayLogoUrl : md.homeLogoUrl;
  const ownGoals = isHome ? md.homeGoals : md.awayGoals;
  const opponentGoals = isHome ? md.awayGoals : md.homeGoals;

  const outcome: MatchOutcome = ownGoals > opponentGoals ? 'win' : ownGoals < opponentGoals ? 'loss' : 'draw';

  return {
    isHome,
    opponentId,
    opponentName: teamNames.get(opponentId) || `Team ${opponentId}`,
    opponentLogoUrl,
    ownGoals,
    opponentGoals,
    outcome,
  };
}

export interface MatchdayState {
  /** Spieltag, für den noch aufgestellt werden kann. */
  open: { day: number; deadline: string } | null;
  /** Spieltag, dessen Anstoß durch ist und der noch nicht komplett abgerechnet ist. */
  running: { day: number } | null;
}

/**
 * Leitet aus dem Spielplan der Competition ab, welcher Spieltag gerade läuft
 * (Anstoß vorbei, aber nicht alle Ergebnisse da) und welcher als nächstes
 * noch offen zum Aufstellen ist. Pure Funktion, `nowMs` explizit übergeben,
 * damit der Screen selbst entscheidet, wie oft neu ausgewertet wird.
 */
export function resolveMatchdayState(schedule: MatchdaySchedule, nowMs: number): MatchdayState {
  const sorted = [...schedule.matchdays].sort((a, b) => a.day - b.day);

  const open = sorted.find(
    (md): md is typeof md & { firstKickoff: string } =>
      md.firstKickoff !== null && new Date(md.firstKickoff).getTime() > nowMs,
  );

  const runningCandidates = sorted.filter(
    (md) => md.firstKickoff !== null && new Date(md.firstKickoff).getTime() <= nowMs && !md.allPlayed,
  );
  const running = runningCandidates[runningCandidates.length - 1];

  return {
    open: open ? { day: open.day, deadline: open.firstKickoff } : null,
    running: running ? { day: running.day } : null,
  };
}

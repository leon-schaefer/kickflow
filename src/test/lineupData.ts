import type { LineupData, SquadPlayer } from '@/api/kickbase';

/**
 * `LineupData`-Attrappe für DOM-Tests. Die meisten Screens interessieren sich
 * nur für `players` — alles andere bekommt neutrale Werte, damit ein Test
 * nicht acht Felder aufführen muss, die er gar nicht liest.
 */
export function lineupData(players: SquadPlayer[] = [], overrides: Partial<LineupData> = {}): LineupData {
  return {
    matchday: null,
    lineupDeadline: null,
    formation: '4-4-2',
    formationRows: [1, 4, 4, 2],
    teamValue: players.reduce((sum, p) => sum + p.marketValue, 0),
    lineupPlayerCount: players.filter((p) => p.inLineup).length,
    confirmedCount: 0,
    players,
    ...overrides,
  };
}

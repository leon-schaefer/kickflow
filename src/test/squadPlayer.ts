import type { SquadPlayer } from '@/api/kickbase';

/**
 * Kaderspieler-Attrappe für DOM-Tests. `src/mock/mockLineup.ts` liefert einen
 * ganzen 23-Mann-Kader für den Optimizer; hier geht es um einzelne Zeilen und
 * Karten, für die ein Feld-für-Feld-Override kürzer ist als ein Kader.
 */
export function squadPlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: '1',
    name: 'Musiala',
    position: 'MID',
    teamId: '2',
    marketValue: 12_000_000,
    marketValueTrend: 'up',
    marketValueChangeToday: 50_000,
    totalPoints: 400,
    averagePoints: 120,
    valueScoreAvg: 10,
    valueScoreTotal: 33,
    status: 'fit',
    statusDetails: [],
    imageUrl: null,
    teamLogoUrl: null,
    inLineup: true,
    lineupSlot: 1,
    isCaptain: false,
    onMarket: false,
    offerCount: 0,
    nextMatch: null,
    ...overrides,
  };
}

import type { PlayerDetail, Position } from '@/api/kickbase';

/**
 * `PlayerDetail`-Attrappe für DOM-Tests — das breiteste Spieler-Objekt der
 * API (getPlayerBasic/getPlayer). Nur die Felder, die die Screens lesen,
 * bekommen sprechende Werte; der Rest ist neutral.
 */
export function playerDetail(overrides: Partial<PlayerDetail> = {}): PlayerDetail {
  const empty = { points: [] as never[], lowest: 0, highest: 0 };
  return {
    id: '1',
    firstName: 'Jamal',
    lastName: 'Musiala',
    name: 'Jamal Musiala',
    shirtNumber: 42,
    teamId: '2',
    teamName: 'FC Bayern',
    position: 'MID' as Position,
    goals: 5,
    assists: 3,
    totalPoints: 400,
    averagePoints: 120,
    secondsPlayed: 90 * 60 * 5,
    marketValue: 12_000_000,
    marketValueTrend: 'up',
    yellowCards: 1,
    redCards: 0,
    status: 'fit',
    statusDetails: [],
    imageUrl: null,
    teamLogoUrl: null,
    seasonMatchCount: 5,
    marketValueHistory92: empty,
    marketValueHistory365: empty,
    performance: [],
    ...overrides,
  };
}

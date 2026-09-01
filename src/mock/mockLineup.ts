import type { LineupData, MarketValueTrend, PlayerStatus, Position, SquadPlayer } from '@/api/kickbase';
import { pointsPerMillion } from '@/utils/valueScore';

/**
 * Synthetischer 23-Spieler-Kader zum lokalen Testen des Aufstellungs-Optimizers
 * (echte Konten haben oft nur ~11-15 Spieler, was die meisten Formationen
 * unbesetzbar macht). Aktivierung über USE_MOCK_LINEUP in queries/hooks.ts.
 *
 * Namen sind frei erfunden. valueScoreAvg/valueScoreTotal werden wie im
 * echten Mapper (src/api/kickbase/mappers.ts) über pointsPerMillion() aus
 * marketValue/averagePoints/totalPoints abgeleitet, nicht hartkodiert.
 */
interface MockPlayerSpec {
  id: string;
  name: string;
  position: Position;
  teamId: string;
  marketValue: number;
  averagePoints: number;
  /** Default: gleich averagePoints (in echten Kickbase-Daten meist identisch, siehe mappers.ts). */
  totalPoints?: number;
  status?: PlayerStatus;
  trend?: MarketValueTrend;
  /**
   * Default: 80 % des Marktwerts (also im Plus). `null` = kein bekannter
   * Kaufpreis, ein Vielfaches des Marktwerts = Kaufpreis weit über der
   * Verlaufskurve — beides bewusst gesetzt, damit die Kaufpreis-Anzeige auf
   * der Detailseite im Mock-Modus in allen Zuständen sichtbar wird.
   */
  purchasePrice?: number | null;
  inLineup?: boolean;
  lineupSlot?: number | null;
  isCaptain?: boolean;
}

const SPECS: MockPlayerSpec[] = [
  // Torwart
  { id: 'mock-gk-1', name: 'Jonas Feldmann', position: 'GK', teamId: '1', marketValue: 12_000_000, averagePoints: 90, status: 'fit', inLineup: true, lineupSlot: 0 },
  { id: 'mock-gk-2', name: 'Timo Reuter', position: 'GK', teamId: '2', marketValue: 3_500_000, averagePoints: 40, status: 'fit', purchasePrice: null },

  // Abwehr
  { id: 'mock-def-1', name: 'Lukas Brandt', position: 'DEF', teamId: '1', marketValue: 15_000_000, averagePoints: 95, status: 'fit', inLineup: true, lineupSlot: 1 },
  { id: 'mock-def-2', name: 'Niklas Ehrlich', position: 'DEF', teamId: '3', marketValue: 6_000_000, averagePoints: 85, status: 'fit', inLineup: true, lineupSlot: 2 },
  { id: 'mock-def-3', name: 'Kevin Sander', position: 'DEF', teamId: '4', marketValue: 20_000_000, averagePoints: 60, status: 'fit', inLineup: true, lineupSlot: 3, purchasePrice: 55_000_000 },
  { id: 'mock-def-4', name: 'Ali Yildiz', position: 'DEF', teamId: '5', marketValue: 4_000_000, averagePoints: 70, status: 'fit', inLineup: true, lineupSlot: 4 },
  { id: 'mock-def-5', name: 'Marco Fels', position: 'DEF', teamId: '6', marketValue: 18_000_000, averagePoints: 30, status: 'injured' },
  { id: 'mock-def-6', name: 'Robin Aue', position: 'DEF', teamId: '7', marketValue: 9_000_000, averagePoints: 50, status: 'doubtful' },
  { id: 'mock-def-7', name: 'David Kern', position: 'DEF', teamId: '8', marketValue: 2_000_000, averagePoints: 10, status: 'fit' },

  // Mittelfeld
  { id: 'mock-mid-1', name: 'Jannik Voss', position: 'MID', teamId: '1', marketValue: 25_000_000, averagePoints: 150, status: 'fit', inLineup: true, lineupSlot: 5, isCaptain: true },
  { id: 'mock-mid-2', name: 'Elias Grimm', position: 'MID', teamId: '9', marketValue: 7_000_000, averagePoints: 110, status: 'fit', inLineup: true, lineupSlot: 6 },
  { id: 'mock-mid-3', name: 'Paul Osei', position: 'MID', teamId: '10', marketValue: 5_000_000, averagePoints: 90, status: 'fit', inLineup: true, lineupSlot: 7 },
  { id: 'mock-mid-4', name: 'Simon Wehner', position: 'MID', teamId: '11', marketValue: 30_000_000, averagePoints: 80, status: 'fit' },
  { id: 'mock-mid-5', name: 'Fabian Roth', position: 'MID', teamId: '12', marketValue: 3_000_000, averagePoints: 20, status: 'suspended' },
  { id: 'mock-mid-6', name: 'Tom Adler', position: 'MID', teamId: '13', marketValue: 6_500_000, averagePoints: 55, status: 'fit' },
  { id: 'mock-mid-7', name: 'Jonas Peters', position: 'MID', teamId: '14', marketValue: 1_500_000, averagePoints: -5, status: 'fit' },

  // Angriff
  { id: 'mock-fwd-1', name: 'Leon Krause', position: 'FWD', teamId: '1', marketValue: 28_000_000, averagePoints: 140, status: 'fit', inLineup: true, lineupSlot: 8 },
  { id: 'mock-fwd-2', name: 'Milan Cvetkovic', position: 'FWD', teamId: '15', marketValue: 8_000_000, averagePoints: 95, status: 'fit', inLineup: true, lineupSlot: 9 },
  { id: 'mock-fwd-3', name: 'Rico Wagner', position: 'FWD', teamId: '16', marketValue: 4_500_000, averagePoints: 60, status: 'fit', inLineup: true, lineupSlot: 10 },
  { id: 'mock-fwd-4', name: 'Ben Thalberg', position: 'FWD', teamId: '17', marketValue: 22_000_000, averagePoints: 40, status: 'fit' },
  { id: 'mock-fwd-5', name: 'Youssef Amara', position: 'FWD', teamId: '18', marketValue: 16_000_000, averagePoints: 20, status: 'away' },
  { id: 'mock-fwd-6', name: 'Erik Nowak', position: 'FWD', teamId: '3', marketValue: 1_000_000, averagePoints: 5, status: 'fit' },
  { id: 'mock-fwd-7', name: 'Finn Ostermann', position: 'FWD', teamId: '4', marketValue: 12_000_000, averagePoints: 75, status: 'doubtful' },
];

function buildPlayer(spec: MockPlayerSpec): SquadPlayer {
  const totalPoints = spec.totalPoints ?? spec.averagePoints;
  return {
    id: spec.id,
    name: spec.name,
    position: spec.position,
    teamId: spec.teamId,
    marketValue: spec.marketValue,
    marketValueTrend: spec.trend ?? 'flat',
    marketValueChangeToday: 0,
    purchasePrice:
      spec.purchasePrice === undefined ? Math.round(spec.marketValue * 0.8) : spec.purchasePrice,
    totalPoints,
    averagePoints: spec.averagePoints,
    valueScoreAvg: pointsPerMillion(spec.averagePoints, spec.marketValue),
    valueScoreTotal: pointsPerMillion(totalPoints, spec.marketValue),
    status: spec.status ?? 'fit',
    statusDetails: [],
    imageUrl: null,
    teamLogoUrl: null,
    inLineup: spec.inLineup ?? false,
    lineupSlot: spec.lineupSlot ?? null,
    isCaptain: spec.isCaptain ?? false,
    onMarket: false,
    offerCount: 0,
    nextMatch: null,
  };
}

const mockPlayers = SPECS.map(buildPlayer);

export const mockLineupData: LineupData = {
  matchday: 3,
  lineupDeadline: '2026-09-05T18:30:00Z',
  formation: '4-3-3',
  formationRows: [4, 3, 3],
  teamValue: mockPlayers.reduce((sum, p) => sum + p.marketValue, 0),
  lineupPlayerCount: mockPlayers.filter((p) => p.inLineup).length,
  confirmedCount: mockPlayers.filter((p) => p.inLineup).length,
  players: mockPlayers,
};

/**
 * Domain-Typen, wie sie die App verwendet — normalisiert aus den kryptischen
 * Kickbase-Kürzeln (siehe schemas.ts / mappers.ts). Nichts hier kennt die
 * Rohfeldnamen der Kickbase-API.
 */

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PlayerStatus =
  | 'fit'
  | 'injured'
  | 'doubtful'
  | 'rehab'
  | 'suspended'
  | 'away'
  | 'unknown';

export type MarketValueTrend = 'up' | 'down' | 'flat';

export interface Team {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface NextMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
}

export interface SquadPlayer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position: Position;
  teamId: string;

  marketValue: number;
  marketValueTrend: MarketValueTrend;
  marketValueChangeToday: number;

  totalPoints: number;
  averagePoints: number;
  /** Ø-Punkte je Million Marktwert — aktuelle Form relativ zum Preis. */
  valueScoreAvg: number;
  /** Gesamtpunkte je Million Marktwert — Saisonertrag relativ zum Preis. */
  valueScoreTotal: number;

  status: PlayerStatus;
  statusDetails: string[];

  imageUrl: string | null;
  teamLogoUrl: string | null;

  inLineup: boolean;
  lineupSlot: number | null;
  isCaptain: boolean;

  onMarket: boolean;
  offerCount: number;

  nextMatch: NextMatch | null;
}

/** Ein auf dem Transfermarkt der Liga gelisteter Spieler. */
export interface MarketPlayer {
  id: string;
  name: string;
  position: Position;
  teamId: string;

  marketValue: number;
  marketValueTrend: MarketValueTrend;

  totalPoints: number;
  averagePoints: number;
  valueScoreAvg: number;
  valueScoreTotal: number;

  status: PlayerStatus;
  imageUrl: string | null;

  /** Angebotspreis des Verkäufers (kann vom Marktwert abweichen). */
  price: number;
  /** true = kein Manager als Verkäufer (freier Spieler/Kickbase-Listing). */
  isBotListing: boolean;
  sellerName: string | null;
  offerCount: number;
  listedAt: string | null;
}

export interface LineupData {
  /** Aus `mdln` geparst — nur Fallback, siehe `MatchdaySchedule`/`resolveMatchdayState`. */
  matchday: number | null;
  lineupDeadline: string | null;
  formation: string;
  formationRows: number[];
  teamValue: number;
  lineupPlayerCount: number;
  confirmedCount: number;
  players: SquadPlayer[];
}

export interface MarketValuePoint {
  date: number;
  value: number;
}

export interface MarketValueHistory {
  points: MarketValuePoint[];
  lowest: number;
  highest: number;
}

export interface MatchdayPerformance {
  matchday: number;
  matchDate: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  playerTeamId: string;
  /** true, wenn der Spieltag bereits ausgetragen wurde (Ergebnis vorhanden). */
  hasResult: boolean;
  // Kein `status` hier: das `st`-Feld auf Spieltagsebene ist ein anderes
  // Vokabular als der Fitness-Status (st=0/2 bei Kader/Spieler) — laut
  // scripts/probe.ts wurden dort 3/4/5 beobachtet, unbekannte Bedeutung.
  /** Punkte GENAU dieses Spieltags (Rohfeld `p`). */
  points: number;
  /** Saison-Ø bzw. -Summe — auf jedem Spieltag derselbe Wert, NICHT je Spieltag. */
  seasonAveragePoints: number;
  seasonTotalPoints: number;
  minutesPlayed: number;
  isCurrent: boolean;
}

export interface SeasonPerformance {
  title: string;
  leagueName: string;
  matchdays: MatchdayPerformance[];
}

/** Ein Spieltag aus `/v4/competitions/{id}/matchdays` — der Spielplan der gesamten Competition. */
export interface ScheduledMatchday {
  day: number;
  /** Frühester Anstoß dieses Spieltags = Aufstellungs-Deadline. */
  firstKickoff: string | null;
  /** true, wenn ALLE Spiele des Tages ein Ergebnis haben (Spieltag durch). */
  allPlayed: boolean;
}

export interface MatchdaySchedule {
  /** Top-Level `day` der API — nur Fallback, nicht die Wahrheit, siehe resolveMatchdayState. */
  currentDay: number | null;
  matchdays: ScheduledMatchday[];
}

export interface PlayerDetail {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  shirtNumber: number | null;
  teamId: string;
  teamName: string;
  position: Position;
  goals: number;
  assists: number;
  totalPoints: number;
  averagePoints: number;
  secondsPlayed: number;
  marketValue: number;
  marketValueTrend: MarketValueTrend;
  yellowCards: number;
  redCards: number;
  status: PlayerStatus;
  statusDetails: string[];
  imageUrl: string | null;
  teamLogoUrl: string | null;
  seasonMatchCount: number;
  marketValueHistory92: MarketValueHistory;
  marketValueHistory365: MarketValueHistory;
  performance: SeasonPerformance[];
}

export interface LeagueSummary {
  id: string;
  name: string;
  coverImageUrl: string | null;
  budget: number;
  teamValue: number;
  memberCount: number;
  playerLimit: number;
  isAdmin: boolean;
  competitionId: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
}

export interface SaveLineupInput {
  formation: string;
  playerIds: string[];
}

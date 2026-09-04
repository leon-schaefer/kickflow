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

/** Ein für mich sichtbares Gebot auf einen Marktplayer (aus `ofs[]`, siehe rawMarketOfferSchema). */
export interface MarketOffer {
  userId: string | null;
  userName: string | null;
  price: number;
  userImageUrl: string | null;
}

/** Eingabe für `placeOffer` — ein neues Gebot auf einen Marktspieler. */
export interface PlaceOfferInput {
  playerId: string;
  price: number;
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
  /** User-ID des Verkäufers (Rohfeld `u.i`) — zugleich der Besitzer, siehe resolvePlayerOwner. */
  sellerId: string | null;
  offerCount: number;
  listedAt: string | null;

  /** Restlaufzeit in Sekunden — nur bei Kickbase-Listings gesetzt, Manager-Listings laufen nie ab. */
  expiresInSeconds: number | null;
  /** Mein eigener Gebotspreis, falls ich schon geboten habe (Rohfeld `uop`). */
  ownOfferPrice: number | null;
  /**
   * Meine eigene User-ID, sobald ich geboten habe (Rohfeld `uoid`) — zugleich
   * die Offer-ID, die `removeOffer` zum Zurückziehen braucht.
   */
  ownOfferId: string | null;
  /** Die für mich sichtbaren Gebote. Bei fremden Listings nur mein eigenes. */
  offers: MarketOffer[];
}

/** Rückgabe von getMarket() — die Liste plus den Zeitpunkt, zu dem Kickbase als Nächstes die Marktwerte neu berechnet. */
export interface MarketData {
  players: MarketPlayer[];
  /** ISO-Zeitpunkt des nächsten Marktwert-Updates (Rohfeld `mvud`), oder null wenn nicht geliefert. */
  marketValueUpdateAt: string | null;
}

/**
 * Ein Spieler aus dem competition-weiten Bestand — Datengrundlage des
 * Spieler-Tabs, in dem ALLE Spieler der Competition durchsuchbar sind, nicht
 * nur eigene (`SquadPlayer`) und gelistete (`MarketPlayer`).
 *
 * Bewusst schmal: genau die Felder, die `MetricPlayer`
 * (src/utils/playerMetric.ts) und `filterPlayers` (src/utils/playerFilter.ts)
 * verlangen. Alles Weitere — Marktwertverlauf, Saisonpunkte je Spieltag,
 * aktueller Besitzer — holt der Spieler-Detail-Screen ohnehin selbst über
 * `getPlayer()`, und das für JEDE Spieler-ID, nicht nur für eigene.
 */
export interface CompetitionPlayer {
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

/** Eine Paarung eines Spieltags — Grundlage für Restprogramm/Gegner-Härte (src/utils/fixtureDifficulty.ts). */
export interface ScheduledFixture {
  homeTeamId: string;
  awayTeamId: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  /** null = noch kein Ergebnis (Spiel steht noch aus). */
  homeGoals: number | null;
  awayGoals: number | null;
  hasResult: boolean;
}

/** Ein Spieltag aus `/v4/competitions/{id}/matchdays` — der Spielplan der gesamten Competition. */
export interface ScheduledMatchday {
  day: number;
  /** Frühester Anstoß dieses Spieltags = Aufstellungs-Deadline. */
  firstKickoff: string | null;
  /** true, wenn ALLE Spiele des Tages ein Ergebnis haben (Spieltag durch). */
  allPlayed: boolean;
  /** Alle Paarungen dieses Spieltags — für Restprogramm/Gegner-Härte, ungenutzt von resolveMatchdayState(). */
  fixtures: ScheduledFixture[];
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

/**
 * Ein Besitzerwechsel eines Spielers innerhalb der Liga — ein Eintrag aus
 * `/v4/leagues/{id}/players/{playerId}/transferHistory`, siehe
 * getPlayerTransferHistory(). Grundlage für "Gekauft am ..." auf dem
 * Spieler-Screen (src/utils/playerPurchase.ts).
 */
export interface PlayerTransfer {
  /** ISO-Zeitpunkt des Transfers (Rohfeld `dt`). */
  date: string;
  /**
   * Der Käufer. `null`, wenn Kickbase zu diesem Transfer keinen Manager
   * nennt — laut Doku kommt das vor (z. B. Kauf vom Kickbase-Angebot).
   */
  buyerId: string | null;
  buyerName: string | null;
  /** Gezahlter Preis (Rohfeld `trp`); 0, wenn die Antwort keinen liefert. */
  price: number;
}

/** Ein Manager in der Liga-Tabelle (`/v4/leagues/{id}/ranking`), siehe getLeagueRanking(). */
export interface LeagueRankingEntry {
  userId: string;
  userName: string;
  userImageUrl: string | null;
  isAdmin: boolean;
  /** true = Aufstellung für den aktuellen Spieltag steht. */
  hasLineupSet: boolean;
  seasonPoints: number;
  seasonPlace: number;
  matchdayPoints: number;
  matchdayPlace: number;
  teamValue: number;
  /**
   * Die 11 Spieler-IDs seiner Startelf — NUR die Startelf, nicht der ganze
   * Kader (Bankspieler bleiben unsichtbar). `null` = leerer Slot.
   */
  lineupPlayerIds: (string | null)[];
  /**
   * Duell-Gegner im ligaeigenen Kopf-an-Kopf-Modus (`hhoui`) — `null` = Liga
   * ohne Duell-Modus oder Saison noch nicht gestartet (fehlt komplett in
   * scripts/.probe-output/ranking-12924185.json, einer 2-Manager-Dev-Liga).
   */
  h2hOpponentUserId: string | null;
  /** Platz in der Duell-Tabelle; 0 = kein Duell-Modus. */
  h2hPlace: number;
  h2hSeasonPoints: number;
  h2hMatchdayPoints: number;
}

export interface LeagueRanking {
  seasonName: string | null;
  /**
   * Spieltag, auf den sich diese Antwort laut Kickbase bezieht — `null`, wenn
   * das Feld fehlt. Dient als Gegenprobe zum angefragten `dayNumber`: stimmt
   * es nicht, ist die gelieferte Startelf nicht die des gewünschten Spieltags.
   */
  day: number | null;
  entries: LeagueRankingEntry[];
}

/** `GET /v4/leagues/{id}/overview` — Liga-Einstellungen, siehe getLeagueOverview(). */
export interface LeagueOverview {
  /** `mpst` — Kickbases eigener Wert für "max. Spieler pro Verein"; nicht offiziell dokumentiert. */
  maxPlayersPerTeam: number | null;
  /** `mppu` — maximale Kadergröße. */
  maxSquadSize: number | null;
  managerCount: number | null;
}

export interface LeagueSummary {
  id: string;
  name: string;
  coverImageUrl: string | null;
  budget: number;
  teamValue: number;
  /** null = konnte nicht ermittelt werden (Zusatzrequest fehlgeschlagen), siehe getLeagues(). */
  memberCount: number | null;
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

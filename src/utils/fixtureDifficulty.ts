/**
 * Gegner-Härte fürs Restprogramm (siehe app/(app)/[leagueId]/fixtures.tsx) und
 * als drittes Optimizer-Signal (siehe src/lineup/useLineupOptimizer.ts).
 *
 * Bewusst OHNE einen neuen Kickbase-Endpoint: Vereinsstärke wird ausschließlich
 * aus den Ergebnissen des bereits geladenen Spielplans (`useMatchdays`,
 * `MatchdaySchedule.matchdays[].fixtures`) abgeleitet. `/v4/competitions/{id}/ranking`
 * würde eine saubere, direkt von Kickbase berechnete Stärke liefern, ist aber
 * noch nicht gegen einen echten Account verifiziert (siehe Plan, Abschnitt
 * "Verifikation") — bis dahin ist die Tore-Bilanz die risikoärmere Quelle.
 *
 * Offensive und defensive Härte werden bewusst getrennt (wie bei Base XI):
 * Ein torgefährlicher, aber löchriger Gegner ist für Stürmer leicht, für die
 * eigene Abwehr schwer — und umgekehrt.
 */
import type { MatchdaySchedule, Position } from '@/api/kickbase';

export interface TeamGoalRecord {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** Tore-Bilanz je Verein aus allen bereits ausgetragenen Spielen des Spielplans. */
export function teamGoalRecord(schedule: MatchdaySchedule): Map<string, TeamGoalRecord> {
  const record = new Map<string, TeamGoalRecord>();

  function add(teamId: string, scored: number, conceded: number) {
    if (!teamId) return;
    const entry = record.get(teamId) ?? { played: 0, goalsFor: 0, goalsAgainst: 0 };
    entry.played += 1;
    entry.goalsFor += scored;
    entry.goalsAgainst += conceded;
    record.set(teamId, entry);
  }

  for (const matchday of schedule.matchdays) {
    for (const fixture of matchday.fixtures) {
      if (!fixture.hasResult || fixture.homeGoals == null || fixture.awayGoals == null) continue;
      add(fixture.homeTeamId, fixture.homeGoals, fixture.awayGoals);
      add(fixture.awayTeamId, fixture.awayGoals, fixture.homeGoals);
    }
  }

  return record;
}

export interface TeamStrength {
  /** 0..1, höher = im Schnitt torgefährlicher. */
  attack: number;
  /** 0..1, höher = im Schnitt schwerer zu bespielen (wenig Gegentore). */
  defense: number;
}

/**
 * Min-Max-Normalisierung über alle Vereine mit mindestens einem ausgetragenen
 * Spiel — 0/1 sind also relativ zur aktuellen Saisonspanne, nicht absolut.
 * Vereine ganz ohne Ergebnis (Saisonstart) fehlen in der Map; Aufrufer fallen
 * dann auf einen neutralen Wert zurück (siehe `fixtureDifficulty`).
 */
export function teamStrength(records: Map<string, TeamGoalRecord>): Map<string, TeamStrength> {
  const rates = [...records.entries()]
    .filter(([, r]) => r.played > 0)
    .map(([teamId, r]) => ({
      teamId,
      attackRate: r.goalsFor / r.played,
      defenseRate: r.goalsAgainst / r.played,
    }));

  const strengths = new Map<string, TeamStrength>();
  if (rates.length === 0) return strengths;

  const attackRates = rates.map((r) => r.attackRate);
  const defenseRates = rates.map((r) => r.defenseRate);
  const minAttack = Math.min(...attackRates);
  const maxAttack = Math.max(...attackRates);
  const minDefense = Math.min(...defenseRates);
  const maxDefense = Math.max(...defenseRates);

  for (const r of rates) {
    strengths.set(r.teamId, {
      attack: normalize(r.attackRate, minAttack, maxAttack),
      // Weniger Gegentore je Spiel = stärkere Abwehr → invertiert.
      defense: 1 - normalize(r.defenseRate, minDefense, maxDefense),
    });
  }
  return strengths;
}

function normalize(value: number, min: number, max: number): number {
  return max > min ? (value - min) / (max - min) : 0.5;
}

export interface UpcomingFixture {
  day: number;
  opponentId: string;
  isHome: boolean;
  /**
   * Vereinslogo des Gegners, direkt aus dem Spielplan — damit die Anzeige
   * (siehe FixtureDifficultyStrip) kein zweites Query auf die Competition-
   * Tabelle braucht und nicht davon abhängt, dass beide Quellen dieselben
   * teamIds benutzen.
   */
  opponentLogoUrl: string | null;
}

/** Index Verein → alle seine Paarungen der Saison, nach Spieltag sortiert. */
export function buildFixtureIndex(schedule: MatchdaySchedule): Map<string, UpcomingFixture[]> {
  const index = new Map<string, UpcomingFixture[]>();

  function add(teamId: string, entry: UpcomingFixture) {
    if (!teamId) return;
    const list = index.get(teamId);
    if (list) list.push(entry);
    else index.set(teamId, [entry]);
  }

  for (const matchday of schedule.matchdays) {
    for (const fixture of matchday.fixtures) {
      add(fixture.homeTeamId, {
        day: matchday.day,
        opponentId: fixture.awayTeamId,
        isHome: true,
        opponentLogoUrl: fixture.awayLogoUrl,
      });
      add(fixture.awayTeamId, {
        day: matchday.day,
        opponentId: fixture.homeTeamId,
        isHome: false,
        opponentLogoUrl: fixture.homeLogoUrl,
      });
    }
  }
  for (const list of index.values()) list.sort((a, b) => a.day - b.day);
  return index;
}

/** Die nächsten `count` Paarungen eines Vereins ab (einschließlich) `fromDay`. */
export function remainingFixtures(
  teamId: string,
  index: Map<string, UpcomingFixture[]>,
  fromDay: number,
  count: number,
): UpcomingFixture[] {
  return (index.get(teamId) ?? []).filter((f) => f.day >= fromDay).slice(0, count);
}

export interface FixtureDifficultyRating extends UpcomingFixture {
  /** 0..1, höher = schwerer für die eigenen Stürmer/Mittelfeldspieler (Gegner defensiv stark). */
  attackDifficulty: number;
  /** 0..1, höher = schwerer für die eigene Abwehr/den Torwart (Gegner offensiv stark). */
  defenseDifficulty: number;
}

export interface FixtureDifficultyOptions {
  /** Abzug/Zuschlag auf die Gegnerstärke je nach Heimrecht — Default 0,05. */
  homeAdvantage?: number;
}

/**
 * Ohne bekannte Stärke (Saisonstart, oder Gegner noch ohne Ergebnis) gilt ein
 * neutraler Wert (0,5) statt eine Fehlerbehandlung zu erzwingen — die Härte
 * "unbekannt" ist selbst eine sinnvolle Aussage (weder leicht noch schwer).
 */
export function fixtureDifficulty(
  fixtures: readonly UpcomingFixture[],
  strengths: Map<string, TeamStrength>,
  options: FixtureDifficultyOptions = {},
): FixtureDifficultyRating[] {
  const homeAdvantage = options.homeAdvantage ?? 0.05;
  return fixtures.map((fixture) => {
    const opponent = strengths.get(fixture.opponentId) ?? { attack: 0.5, defense: 0.5 };
    const venueBonus = fixture.isHome ? homeAdvantage : -homeAdvantage;
    return {
      ...fixture,
      attackDifficulty: clamp01(opponent.defense - venueBonus),
      defenseDifficulty: clamp01(opponent.attack - venueBonus),
    };
  });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface AverageDifficulty {
  attack: number;
  defense: number;
}

export function averageDifficulty(ratings: readonly FixtureDifficultyRating[]): AverageDifficulty {
  if (ratings.length === 0) return { attack: 0.5, defense: 0.5 };
  return {
    attack: ratings.reduce((sum, r) => sum + r.attackDifficulty, 0) / ratings.length,
    defense: ratings.reduce((sum, r) => sum + r.defenseDifficulty, 0) / ratings.length,
  };
}

/**
 * Welche der beiden Härten für die Punkteerwartung einer Position zählt:
 * Torwart/Abwehr leiden unter einem gefährlichen gegnerischen Angriff
 * (weniger Chance auf Bonuspunkte für ein zu-null), Mittelfeld/Sturm unter
 * einer stabilen gegnerischen Abwehr (schwerer zu treffen).
 */
export function positionDifficulty(position: Position, avg: AverageDifficulty): number {
  return position === 'GK' || position === 'DEF' ? avg.defense : avg.attack;
}

/**
 * Übersetzt eine Härte (0..1, 0,5 = durchschnittlich) in einen Punkte-Multiplikator
 * um 1,0 herum — Basis für `expectedPoints` im Optimizer. `strength` begrenzt
 * den Ausschlag: bei 0,4 reicht die Spanne von 0,8x (schwerster Gegner) bis
 * 1,2x (leichtester Gegner). Kein Anspruch auf ein kalibriertes Modell — ein
 * bewusst grober, aber transparenter Faktor (siehe OptimizerBar-Hinweistext).
 */
export function difficultyFactor(difficulty: number, strength = 0.4): number {
  return 1 + (0.5 - difficulty) * strength;
}

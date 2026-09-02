import { describe, expect, it } from 'vitest';
import type { MatchdaySchedule } from '@/api/kickbase';
import {
  averageDifficulty,
  buildFixtureIndex,
  difficultyFactor,
  fixtureDifficulty,
  positionDifficulty,
  remainingFixtures,
  teamGoalRecord,
  teamStrength,
} from './fixtureDifficulty';

function fixture(
  homeTeamId: string,
  awayTeamId: string,
  homeGoals: number | null = null,
  awayGoals: number | null = null,
) {
  return {
    homeTeamId,
    awayTeamId,
    homeLogoUrl: `https://cdn.example/${homeTeamId}.svg`,
    awayLogoUrl: `https://cdn.example/${awayTeamId}.svg`,
    homeGoals,
    awayGoals,
    hasResult: homeGoals !== null && awayGoals !== null,
  };
}

/** Eine Paarung aus Sicht eines Vereins, wie `buildFixtureIndex` sie liefert. */
function upcoming(day: number, opponentId: string, isHome: boolean, opponentLogoUrl: string | null = null) {
  return { day, opponentId, isHome, opponentLogoUrl };
}

// Drei Vereine: '1' schießt viel und kassiert wenig (stark), '2' ist
// ausgeglichen, '3' kassiert viel und schießt wenig (schwach). Spieltag 3 ist
// noch offen (kein Ergebnis) — genau der Fall, für den `remainingFixtures`
// gebraucht wird.
const schedule: MatchdaySchedule = {
  currentDay: 2,
  matchdays: [
    { day: 1, firstKickoff: null, allPlayed: true, fixtures: [fixture('1', '3', 4, 0)] },
    { day: 2, firstKickoff: null, allPlayed: true, fixtures: [fixture('2', '1', 1, 1), fixture('3', '2', 0, 3)] },
    { day: 3, firstKickoff: null, allPlayed: false, fixtures: [fixture('1', '2')] },
  ],
};

describe('teamGoalRecord', () => {
  it('summiert Tore für/gegen nur aus ausgetragenen Spielen', () => {
    const record = teamGoalRecord(schedule);
    expect(record.get('1')).toEqual({ played: 2, goalsFor: 5, goalsAgainst: 1 });
    expect(record.get('3')).toEqual({ played: 2, goalsFor: 0, goalsAgainst: 7 });
  });

  it('ignoriert Spiele ohne Ergebnis komplett', () => {
    const record = teamGoalRecord(schedule);
    // Verein '1' hat 3 Paarungen im Spielplan, aber nur 2 mit Ergebnis.
    expect(record.get('1')?.played).toBe(2);
  });
});

describe('teamStrength', () => {
  it('normalisiert Angriff/Abwehr relativ zur Saisonspanne', () => {
    const strengths = teamStrength(teamGoalRecord(schedule));
    const strong = strengths.get('1')!;
    const weak = strengths.get('3')!;
    expect(strong.attack).toBeGreaterThan(weak.attack);
    expect(strong.defense).toBeGreaterThan(weak.defense);
    expect(strong.attack).toBeCloseTo(1, 5);
    expect(weak.attack).toBeCloseTo(0, 5);
  });

  it('liefert eine leere Map, wenn noch kein Spiel ausgetragen wurde', () => {
    const empty = teamStrength(new Map());
    expect(empty.size).toBe(0);
  });
});

describe('buildFixtureIndex + remainingFixtures', () => {
  it('indiziert beide Seiten jeder Paarung und sortiert nach Spieltag', () => {
    const index = buildFixtureIndex(schedule);
    expect(index.get('1')).toEqual([
      upcoming(1, '3', true, 'https://cdn.example/3.svg'),
      upcoming(2, '2', false, 'https://cdn.example/2.svg'),
      upcoming(3, '2', true, 'https://cdn.example/2.svg'),
    ]);
  });

  it('liefert nur zukünftige Paarungen ab fromDay, begrenzt auf count', () => {
    const index = buildFixtureIndex(schedule);
    expect(remainingFixtures('1', index, 3, 5)).toEqual([upcoming(3, '2', true, 'https://cdn.example/2.svg')]);
    expect(remainingFixtures('1', index, 1, 1)).toEqual([upcoming(1, '3', true, 'https://cdn.example/3.svg')]);
  });

  it('liefert ein leeres Array für einen unbekannten Verein statt zu crashen', () => {
    const index = buildFixtureIndex(schedule);
    expect(remainingFixtures('999', index, 1, 5)).toEqual([]);
  });
});

describe('fixtureDifficulty', () => {
  const strengths = teamStrength(teamGoalRecord(schedule));

  it('macht ein Heimspiel gegen den schwachen Verein leicht für Angreifer', () => {
    const [rating] = fixtureDifficulty([upcoming(3, '3', true)], strengths);
    // '3' ist die schwächste Abwehr → attackDifficulty niedrig.
    expect(rating!.attackDifficulty).toBeLessThan(0.5);
  });

  it('macht ein Auswärtsspiel gegen den starken Verein schwer für die eigene Abwehr', () => {
    const [rating] = fixtureDifficulty([upcoming(3, '1', false)], strengths);
    // '1' hat den stärksten Angriff, plus Auswärts-Malus → hohe defenseDifficulty.
    expect(rating!.defenseDifficulty).toBeGreaterThan(0.5);
  });

  it('fällt bei unbekannter Gegnerstärke auf neutral (0,5) zurück statt zu crashen', () => {
    const [rating] = fixtureDifficulty([upcoming(3, 'unbekannt', true)], strengths);
    expect(rating!.attackDifficulty).toBeCloseTo(0.45, 5); // 0,5 − Heimvorteil 0,05
  });
});

describe('averageDifficulty', () => {
  it('mittelt über mehrere Paarungen', () => {
    const ratings = fixtureDifficulty(
      [upcoming(3, '1', true), upcoming(4, '3', true)],
      teamStrength(teamGoalRecord(schedule)),
    );
    const avg = averageDifficulty(ratings);
    expect(avg.attack).toBeCloseTo((ratings[0]!.attackDifficulty + ratings[1]!.attackDifficulty) / 2, 5);
  });

  it('liefert neutral (0,5/0,5) bei leerem Restprogramm statt zu crashen', () => {
    expect(averageDifficulty([])).toEqual({ attack: 0.5, defense: 0.5 });
  });
});

describe('positionDifficulty', () => {
  // avg.attack = gemittelte attackDifficulty (schwer für MEINE Stürmer, weil
  // der Gegner defensiv stark ist); avg.defense = gemittelte defenseDifficulty
  // (schwer für MEINE Abwehr/Torwart, weil der Gegner offensiv stark ist).
  const avg = { attack: 0.8, defense: 0.2 };
  it('nimmt für Torwart/Abwehr die defenseDifficulty (Gegner offensiv stark = schwer für uns)', () => {
    expect(positionDifficulty('GK', avg)).toBe(0.2);
    expect(positionDifficulty('DEF', avg)).toBe(0.2);
  });
  it('nimmt für Mittelfeld/Sturm die attackDifficulty (Gegner defensiv stark = schwer für uns)', () => {
    expect(positionDifficulty('MID', avg)).toBe(0.8);
    expect(positionDifficulty('FWD', avg)).toBe(0.8);
  });
});

describe('difficultyFactor', () => {
  it('ist 1,0 bei durchschnittlicher Härte', () => {
    expect(difficultyFactor(0.5)).toBeCloseTo(1, 5);
  });
  it('ist größer als 1 bei leichtem Gegner, kleiner als 1 bei schwerem', () => {
    expect(difficultyFactor(0)).toBeGreaterThan(1);
    expect(difficultyFactor(1)).toBeLessThan(1);
  });
});

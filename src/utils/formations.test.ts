import { describe, expect, it } from 'vitest';
import { AVAILABLE_FORMATIONS, formationFor, requiredCountsForFormation } from './formations';

describe('requiredCountsForFormation', () => {
  it('parst "3-4-3" zu GK 1, DEF 3, MID 4, FWD 3', () => {
    expect(requiredCountsForFormation('3-4-3')).toEqual({ GK: 1, DEF: 3, MID: 4, FWD: 3 });
  });

  it('jede Formation aus AVAILABLE_FORMATIONS summiert auf exakt 11 Spieler', () => {
    // Diese Invariante ist die Voraussetzung dafür, dass Summe und Mittel im
    // Optimizer dasselbe Ranking erzeugen — hier geprüft statt angenommen.
    for (const formation of AVAILABLE_FORMATIONS) {
      const required = requiredCountsForFormation(formation);
      const total = required.GK + required.DEF + required.MID + required.FWD;
      expect(total).toBe(11);
    }
  });

  it('kennt 3-6-1 — sechs Mittelfeldspieler sind bei Kickbase erlaubt', () => {
    expect(AVAILABLE_FORMATIONS).toContain('3-6-1');
    expect(requiredCountsForFormation('3-6-1')).toEqual({ GK: 1, DEF: 3, MID: 6, FWD: 1 });
  });

  it('kennt 5-2-3 — fünf Verteidiger mit nur zwei Mittelfeldspielern', () => {
    // Die einzige Formation mit Fünferkette und drei Stürmern; ohne sie hat ein
    // Kader mit drei Stürmern und nur zwei Mittelfeldspielern keine Fünferkette.
    expect(AVAILABLE_FORMATIONS).toContain('5-2-3');
    expect(requiredCountsForFormation('5-2-3')).toEqual({ GK: 1, DEF: 5, MID: 2, FWD: 3 });
  });

  it('enthält genau die zehn Formationen, die Kickbase zur Wahl stellt', () => {
    // Die Liste ist eine feste Auswahl, keine berechenbare Menge: die
    // Mindestbesetzung (1/3/2/1) ließe auch 3-3-4 und 3-2-5 zu, beide bietet
    // Kickbase nicht an. Deshalb hier als Ganzes festgehalten — wer eine
    // Formation ergänzt oder streicht, tut das gegen diese Liste.
    expect([...AVAILABLE_FORMATIONS].sort()).toEqual([
      '3-4-3',
      '3-5-2',
      '3-6-1',
      '4-2-4',
      '4-3-3',
      '4-4-2',
      '4-5-1',
      '5-2-3',
      '5-3-2',
      '5-4-1',
    ]);
  });

  it('hält die Mindestbesetzung ein, die Kickbase für jede Formation nennt', () => {
    // 1 TW, 3 ABW, 2 MF, 1 ANG — die Regel hinter der Liste. Eine ergänzte
    // Formation, die sie verletzt, wäre bei Kickbase nicht wählbar.
    for (const formation of AVAILABLE_FORMATIONS) {
      const required = requiredCountsForFormation(formation);
      expect(required.GK, formation).toBe(1);
      expect(required.DEF, formation).toBeGreaterThanOrEqual(3);
      expect(required.MID, formation).toBeGreaterThanOrEqual(2);
      expect(required.FWD, formation).toBeGreaterThanOrEqual(1);
    }
  });

  it('liefert bei unparsbarem Input den dokumentierten Fallback', () => {
    const fallback = { GK: 1, DEF: 0, MID: 0, FWD: 0 };
    expect(requiredCountsForFormation('')).toEqual(fallback);
    expect(requiredCountsForFormation('foo')).toEqual(fallback);
    expect(requiredCountsForFormation('4-4')).toEqual(fallback);
  });
});

describe('formationFor', () => {
  it('behält die aktuelle Formation, wenn die Verteilung dort unterkommt', () => {
    // Auch mit unvollständiger Elf: kein Wechsel ohne Not, obwohl andere
    // Formationen die vier Verteidiger genauso aufnehmen würden.
    const kept = formationFor({ GK: 1, DEF: 4, MID: 3, FWD: 2 }, { current: '4-4-2' });
    expect(kept).toBe('4-4-2');
  });

  it('wechselt auf die passende Formation, wenn eine Position überläuft', () => {
    // Dritter Stürmer bei nur zwei Verteidigern — 4-4-2 platzt, 3-4-3 passt.
    const next = formationFor({ GK: 1, DEF: 2, MID: 4, FWD: 3 }, { current: '4-4-2' });
    expect(next).toBe('3-4-3');
  });

  it('wählt unter mehreren passenden die mit dem höchsten Score', () => {
    const counts = { GK: 1, DEF: 3, MID: 3, FWD: 2 };
    const score = (formation: string) => (formation === '4-3-3' ? 10 : formation === '3-4-3' ? 5 : null);
    expect(formationFor(counts, { current: '5-4-1', score })).toBe('4-3-3');
  });

  it('behandelt fehlende Scores als schlechtesten Rang', () => {
    const counts = { GK: 1, DEF: 3, MID: 3, FWD: 2 };
    // Nur die späteste passende Formation ist bewertet — sie gewinnt trotzdem
    // gegen die unbewerteten davor.
    const score = (formation: string) => (formation === '5-3-2' ? 1 : null);
    expect(formationFor(counts, { score })).toBe('5-3-2');
  });

  it('entscheidet ohne Score nach Reihenfolge der Kandidaten', () => {
    const counts = { GK: 1, DEF: 3, MID: 3, FWD: 2 };
    expect(formationFor(counts, { formations: ['4-4-2', '3-4-3'] })).toBe('4-4-2');
    expect(formationFor(counts, { formations: ['3-4-3', '4-4-2'] })).toBe('3-4-3');
  });

  it('wählt 3-6-1 als einzige Formation mit sechs Mittelfeldplätzen', () => {
    // Der sechste Mittelfeldspieler passt sonst nirgends — 4-5-1 und 3-5-2
    // haben nur fünf.
    expect(formationFor({ GK: 1, DEF: 3, MID: 6, FWD: 1 }, { current: '4-5-1' })).toBe('3-6-1');
  });

  it('wählt 5-2-3 für eine Fünferkette mit drei Stürmern', () => {
    // 5-3-2 fasst den dritten Stürmer nicht, 4-2-4 nicht den fünften
    // Verteidiger — nur 5-2-3 nimmt beide auf.
    expect(formationFor({ GK: 1, DEF: 5, MID: 2, FWD: 3 }, { current: '5-3-2' })).toBe('5-2-3');
  });

  it('liefert null, wenn keine Formation die Verteilung aufnimmt', () => {
    // Zwei Torhüter passen in keine Formation, sechs Verteidiger ebensowenig.
    expect(formationFor({ GK: 2, DEF: 4, MID: 3, FWD: 2 }, { current: '4-4-2' })).toBeNull();
    expect(formationFor({ GK: 1, DEF: 6, MID: 3, FWD: 1 }, { current: '4-4-2' })).toBeNull();
  });

  it('ignoriert eine aktuelle Formation, die nicht zu den Kandidaten gehört', () => {
    const counts = { GK: 1, DEF: 3, MID: 3, FWD: 2 };
    expect(AVAILABLE_FORMATIONS).not.toContain('4-4-3');
    expect(formationFor(counts, { current: '4-4-3' })).toBe('3-4-3');
  });
});

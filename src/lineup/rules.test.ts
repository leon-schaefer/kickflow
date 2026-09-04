import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  describeRule,
  isUnconstrained,
  parseStoredRules,
  toConstraints,
  violatedRules,
  type MaxPerTeamRule,
} from './rules';

function rule(overrides: Partial<MaxPerTeamRule> = {}): MaxPerTeamRule {
  return { kind: 'maxPerTeam', id: 'maxPerTeam', enabled: true, max: 2, ...overrides };
}

describe('toConstraints', () => {
  it('liefert Infinity ohne aktive maxPerTeam-Regel', () => {
    expect(toConstraints([])).toEqual({ maxPerTeam: Infinity });
    expect(toConstraints([rule({ enabled: false })])).toEqual({ maxPerTeam: Infinity });
    expect(isUnconstrained(toConstraints([rule({ enabled: false })]))).toBe(true);
  });

  it('übernimmt max von einer aktiven Regel', () => {
    expect(toConstraints([rule({ max: 3 })])).toEqual({ maxPerTeam: 3 });
    expect(isUnconstrained(toConstraints([rule({ max: 3 })]))).toBe(false);
  });
});

describe('describeRule', () => {
  it('beschreibt maxPerTeam lesbar', () => {
    expect(describeRule(rule({ max: 2 }))).toBe('Max. 2 Spieler pro Verein');
  });
});

describe('parseStoredRules', () => {
  it('liefert Defaults bei fehlendem, kaputtem oder leerem Wert', () => {
    expect(parseStoredRules(null)).toEqual(DEFAULT_RULES);
    expect(parseStoredRules('kein-json{')).toEqual(DEFAULT_RULES);
    expect(parseStoredRules('[]')).toEqual(DEFAULT_RULES);
    expect(parseStoredRules(JSON.stringify([{ kind: 'unbekannt' }]))).toEqual(DEFAULT_RULES);
    expect(parseStoredRules(JSON.stringify([{ kind: 'maxPerTeam', id: 'maxPerTeam', enabled: true, max: 99 }]))).toEqual(
      DEFAULT_RULES,
    );
  });

  it('liefert gültig gespeicherte Regeln unverändert zurück', () => {
    const stored = [rule({ enabled: true, max: 4 })];
    expect(parseStoredRules(JSON.stringify(stored))).toEqual(stored);
  });
});

describe('violatedRules', () => {
  const players = [
    { id: 'a', teamId: 'T1' },
    { id: 'b', teamId: 'T1' },
    { id: 'c', teamId: 'T1' },
    { id: 'd', teamId: 'T2' },
  ];

  it('meldet eine aktive Regel, die die Elf verletzt', () => {
    const result = violatedRules([rule({ max: 2 })], players, ['a', 'b', 'c', 'd']);
    expect(result.map((r) => r.id)).toEqual(['maxPerTeam']);
  });

  it('meldet nichts, wenn die Elf die Regel einhält', () => {
    expect(violatedRules([rule({ max: 2 })], players, ['a', 'b', 'd'])).toEqual([]);
  });

  it('ignoriert deaktivierte Regeln', () => {
    expect(violatedRules([rule({ max: 2, enabled: false })], players, ['a', 'b', 'c'])).toEqual([]);
  });

  it('ignoriert IDs ohne bekannten Spieler', () => {
    expect(violatedRules([rule({ max: 2 })], players, ['a', 'b', 'unknown'])).toEqual([]);
  });
});

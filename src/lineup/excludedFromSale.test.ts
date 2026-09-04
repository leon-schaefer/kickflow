import { describe, expect, it } from 'vitest';
import { parseStoredExclusions, serializeExclusions, toggleExclusion } from './excludedFromSale';

describe('parseStoredExclusions', () => {
  it('liest eine gespeicherte ID-Liste', () => {
    expect([...parseStoredExclusions('["1","2"]')]).toEqual(['1', '2']);
  });

  it('liefert eine leere Menge ohne gespeicherten Wert', () => {
    expect(parseStoredExclusions(null).size).toBe(0);
  });

  it('liefert eine leere Menge statt eines Crashs bei kaputtem oder fremdem Wert', () => {
    expect(parseStoredExclusions('{kein json').size).toBe(0);
    expect(parseStoredExclusions('{"a":1}').size).toBe(0);
    expect(parseStoredExclusions('[1,2]').size).toBe(0);
  });

  it('ist ein Roundtrip mit serializeExclusions', () => {
    const ids = new Set(['b', 'a']);
    expect(parseStoredExclusions(serializeExclusions(ids))).toEqual(ids);
  });
});

describe('serializeExclusions', () => {
  it('serialisiert sortiert — gleicher Zustand, gleicher Storage-Wert', () => {
    expect(serializeExclusions(new Set(['b', 'a']))).toBe(serializeExclusions(new Set(['a', 'b'])));
    expect(serializeExclusions(new Set(['b', 'a']))).toBe('["a","b"]');
  });
});

describe('toggleExclusion', () => {
  it('fügt hinzu, entfernt wieder und lässt die Eingabe unangetastet', () => {
    const initial = new Set<string>();
    const added = toggleExclusion(initial, 'x');
    expect([...added]).toEqual(['x']);
    expect(initial.size).toBe(0);

    const removed = toggleExclusion(added, 'x');
    expect(removed.size).toBe(0);
    expect([...added]).toEqual(['x']);
  });
});

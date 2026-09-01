import { describe, expect, it } from 'vitest';
import { marketValueDate, nearestIndex, toChartCoords } from './chart';

describe('nearestIndex', () => {
  it('liefert 0 am linken Rand', () => {
    expect(nearestIndex(0, 100, 5)).toBe(0);
  });
  it('liefert den letzten Index am rechten Rand', () => {
    expect(nearestIndex(100, 100, 5)).toBe(4);
  });
  it('snappt in der Mitte auf den nächsten Punkt', () => {
    // 5 Punkte über Breite 100 → Schritt 25. x=13 liegt näher an 0 als an 25.
    expect(nearestIndex(13, 100, 5)).toBe(1);
    expect(nearestIndex(12, 100, 5)).toBe(0);
  });
  it('clampt Werte außerhalb der Breite', () => {
    expect(nearestIndex(-50, 100, 5)).toBe(0);
    expect(nearestIndex(500, 100, 5)).toBe(4);
  });
  it('liefert 0 bei weniger als zwei Punkten', () => {
    expect(nearestIndex(50, 100, 1)).toBe(0);
    expect(nearestIndex(50, 100, 0)).toBe(0);
  });
  it('liefert 0 bei Breite 0 (noch kein Layout gemessen)', () => {
    expect(nearestIndex(0, 0, 5)).toBe(0);
  });
});

describe('toChartCoords', () => {
  it('platziert ersten und letzten Punkt an den x-Rändern', () => {
    const coords = toChartCoords([1, 5, 3], 100, 50);
    expect(coords[0]!.x).toBe(0);
    expect(coords[2]!.x).toBe(100);
  });
  it('platziert Minimum/Maximum an den y-Rändern ohne padY', () => {
    const coords = toChartCoords([1, 5, 3], 100, 50);
    expect(coords[1]!.y).toBe(0); // Maximum → oben
    expect(coords[0]!.y).toBe(50); // Minimum → unten
  });
  it('respektiert padY beim Skalieren', () => {
    const coords = toChartCoords([1, 5], 100, 50, 5);
    expect(coords[1]!.y).toBe(5); // Maximum, gepolstert
    expect(coords[0]!.y).toBe(45); // Minimum, gepolstert
  });
  it('erzeugt kein NaN bei konstanter Wertreihe', () => {
    const coords = toChartCoords([7, 7, 7], 100, 50);
    expect(coords.every((c) => !Number.isNaN(c.y))).toBe(true);
  });
});

describe('marketValueDate', () => {
  it('interpretiert kleine Werte als Kickbase-Tage seit Epoch', () => {
    const date = marketValueDate(20418);
    expect(date.toISOString().slice(0, 10)).toBe('2025-11-26');
  });
  it('interpretiert große Werte als Sekunden-Timestamp', () => {
    const date = marketValueDate(1_764_115_200); // 2025-11-26T00:00:00Z
    expect(date.toISOString().slice(0, 10)).toBe('2025-11-26');
  });
  it('interpretiert sehr große Werte als Millisekunden-Timestamp', () => {
    const date = marketValueDate(1_764_115_200_000);
    expect(date.toISOString().slice(0, 10)).toBe('2025-11-26');
  });
});

import { describe, expect, it } from 'vitest';
import { formatCountdown, formatCurrency, formatDelta, formatMarketValueDate } from './format';

describe('formatCurrency', () => {
  it('formatiert Millionen', () => {
    expect(formatCurrency(12_300_000)).toBe('12,3 Mio €');
  });
  it('formatiert Tausender', () => {
    expect(formatCurrency(1_500)).toBe('2 Tsd €');
  });
  it('formatiert kleine Beträge', () => {
    expect(formatCurrency(500)).toBe('500 €');
  });
  it('formatiert negative Beträge', () => {
    expect(formatCurrency(-84_771_145)).toBe('-84,8 Mio €');
  });
});

describe('formatDelta', () => {
  it('setzt ein Plus vor positive Werte', () => {
    expect(formatDelta(150_000)).toBe('+150 Tsd €');
  });
  it('setzt ein Minus vor negative Werte', () => {
    expect(formatDelta(-150_000)).toBe('−150 Tsd €');
  });
  it('setzt ein ± bei 0', () => {
    expect(formatDelta(0)).toBe('±0 €');
  });
});

describe('formatMarketValueDate', () => {
  it('formatiert einen Kickbase-Verlaufstag als deutsches Datum', () => {
    expect(formatMarketValueDate(20418)).toBe('26.11.2025');
  });
});

describe('formatCountdown', () => {
  it('zeigt Tage und Stunden bei mehr als einem Tag', () => {
    const ms = 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000;
    expect(formatCountdown(ms)).toBe('2 T 3 Std');
  });
  it('zeigt "abgelaufen" bei negativer/nuller Restzeit', () => {
    expect(formatCountdown(0)).toBe('abgelaufen');
    expect(formatCountdown(-1000)).toBe('abgelaufen');
  });
});

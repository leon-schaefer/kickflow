import { describe, expect, it } from 'vitest';
import {
  formatMetric,
  metricForSort,
  metricNeedsPlaytime,
  metricValue,
  type MetricPlayer,
} from './playerMetric';

const player: MetricPlayer = {
  marketValue: 10_000_000,
  totalPoints: 248,
  averagePoints: 31,
  valueScoreAvg: 3.1,
  valueScoreTotal: 24.8,
};

describe('metricValue', () => {
  it('liefert den Sortierwert je Kennzahl', () => {
    expect(metricValue(player, 'marketValue')).toBe(10_000_000);
    expect(metricValue(player, 'totalPoints')).toBe(248);
    expect(metricValue(player, 'avgPoints')).toBe(31);
    expect(metricValue(player, 'avgPerMillion')).toBe(3.1);
    expect(metricValue(player, 'totalPerMillion')).toBe(24.8);
  });

  it('rechnet Punkte pro Minute aus der Spielzeit', () => {
    expect(metricValue(player, 'pointsPerMinute', { points: 90, minutes: 900 })).toBeCloseTo(0.1);
  });

  it('gibt 0 zurück, wenn die Spielzeit fehlt oder noch lädt', () => {
    expect(metricValue(player, 'pointsPerMinute', undefined)).toBe(0);
    expect(metricValue(player, 'pointsPerMinute', { points: 0, minutes: 0 })).toBe(0);
  });

  it('sortiert unbekannte Gesamtpunkte wie eine fehlende Spielzeit nach unten', () => {
    const unknown: MetricPlayer = { ...player, totalPoints: null, valueScoreTotal: null };
    expect(metricValue(unknown, 'totalPoints')).toBe(0);
    expect(metricValue(unknown, 'totalPerMillion')).toBe(0);
  });
});

describe('formatMetric', () => {
  it('formatiert jede Kennzahl passend', () => {
    expect(formatMetric(player, 'totalPoints')).toBe('248');
    expect(formatMetric(player, 'avgPoints')).toBe('31');
    expect(formatMetric(player, 'avgPerMillion')).toBe('3,1');
    expect(formatMetric(player, 'totalPerMillion')).toBe('24,8');
  });

  it('formatiert Punkte/Min mit zwei Nachkommastellen', () => {
    expect(formatMetric(player, 'pointsPerMinute', { points: 90, minutes: 900 })).toBe('0,10');
  });

  it('zeigt "—" statt eines Fake-"0,00" ohne Einsatzminuten', () => {
    expect(formatMetric(player, 'pointsPerMinute', undefined)).toBe('—');
    expect(formatMetric(player, 'pointsPerMinute', { points: 0, minutes: 0 })).toBe('—');
  });

  it('zeigt "—" statt einer "0", wenn die Quelle keine Gesamtpunkte liefert', () => {
    // Der Bestand des Spieler-Tabs trägt sie nicht (siehe CompetitionPlayer) —
    // eine 0 dort wäre von echten 0 Punkten nicht zu unterscheiden.
    const unknown: MetricPlayer = { ...player, totalPoints: null, valueScoreTotal: null };
    expect(formatMetric(unknown, 'totalPoints')).toBe('—');
    expect(formatMetric(unknown, 'totalPerMillion')).toBe('—');
  });
});

describe('metricNeedsPlaytime', () => {
  it('ist nur bei Punkte/Min wahr', () => {
    expect(metricNeedsPlaytime('pointsPerMinute')).toBe(true);
    expect(metricNeedsPlaytime('marketValue')).toBe(false);
    expect(metricNeedsPlaytime('avgPerMillion')).toBe(false);
  });
});

describe('metricForSort', () => {
  it('gibt die Kennzahl unverändert zurück, wenn sie eine eigene Zelle hat', () => {
    expect(metricForSort('avgPerMillion', 'avgPoints')).toBe('avgPerMillion');
    expect(metricForSort('pointsPerMinute', 'avgPoints')).toBe('pointsPerMinute');
  });

  it('fällt bei "position" und "expiry" auf den Fallback zurück', () => {
    expect(metricForSort('position', 'avgPoints')).toBe('avgPoints');
    expect(metricForSort('expiry', 'avgPerMillion')).toBe('avgPerMillion');
  });
});

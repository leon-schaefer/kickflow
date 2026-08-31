import { marketValueDate } from './chart';

/** Formatiert einen Marktwert kompakt: 12300000 → "12,3 Mio €". */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio €`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 0 })} Tsd €`;
  }
  return `${value.toLocaleString('de-DE')} €`;
}

/** Formatiert eine Marktwert-Änderung mit Vorzeichen: 150000 → "+150 Tsd €". */
export function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

export function formatPoints(value: number): string {
  return value.toLocaleString('de-DE');
}

/** Formatiert einen Kickbase-Verlaufstag: 20418 → "26.11.2025". */
export function formatMarketValueDate(dt: number): string {
  return marketValueDate(dt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Formatiert Punkte/Mio kompakt: 10.5 → "10,5". */
export function formatValueScore(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/**
 * Formatiert Punkte pro Spielminute: 2.447 → "2,45". Zwei Stellen statt einer
 * wie bei formatValueScore: gegen einen echten Kader gemessen liegen die Werte
 * zwischen etwa −1,8 und 2,5, Reservisten drängen sich dabei knapp über 0. Eine
 * Stelle würde genau dort nicht mehr auflösen.
 */
export function formatPointsPerMinute(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

/** Formatiert Spielminuten: 612 → "612'". */
export function formatMinutes(minutes: number): string {
  return `${minutes.toLocaleString('de-DE')}'`;
}

/** Millisekunden bis zu einem ISO-Datum, z. B. für einen Deadline-Countdown. */
export function msUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return target - Date.now();
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'abgelaufen';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} T ${hours} Std`;
  if (hours > 0) return `${hours} Std ${minutes} Min`;
  return `${minutes} Min`;
}

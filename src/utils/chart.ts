export interface ChartPoint {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Index des Datenpunkts, der der Touch-x-Position am nächsten liegt. */
export function nearestIndex(x: number, width: number, count: number): number {
  if (count < 2 || width <= 0) return 0;
  const step = width / (count - 1);
  return clamp(Math.round(x / step), 0, count - 1);
}

/** Skaliert Werte auf SVG-Koordinaten; padY hält die Extrempunkte vom Rand weg. */
export function toChartCoords(values: number[], width: number, height: number, padY = 0): ChartPoint[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerHeight = height - 2 * padY;

  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = padY + (1 - (v - min) / range) * innerHeight;
    return { x, y };
  });
}

/**
 * Kickbase `dt` → Date. Das Feld ist nirgends im Wire-Contract dokumentiert;
 * laut Fixture (mappers.test.ts: `dt: 20418`) sind es Tage seit Epoch, nicht
 * ms. Guard für den Fall, dass ein s- oder ms-Timestamp durchgereicht wird.
 */
export function marketValueDate(dt: number): Date {
  if (dt > 1e12) return new Date(dt);
  if (dt > 1e9) return new Date(dt * 1000);
  return new Date(dt * 86_400_000);
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartScale {
  coords: ChartPoint[];
  /**
   * y-Pixel für einen beliebigen Wert derselben Skala — z. B. eine
   * Referenzlinie, die nicht selbst Teil der Kurve ist.
   */
  valueToY: (value: number) => number;
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

/**
 * Skaliert Werte auf SVG-Koordinaten; padY hält die Extrempunkte vom Rand weg.
 *
 * `extraDomain` zieht zusätzliche Werte in die y-Domain, ohne sie zu zeichnen —
 * gedacht für den Kaufpreis als Referenzlinie. Der wandert bewusst IMMER in die
 * Domain, auch wenn er weit außerhalb der Kurve liegt: eine an den Chartrand
 * geclampte Linie würde suggerieren, die Kurve sei fast am Kaufpreis gewesen.
 * Dass die Kurve dann ins obere/untere Viertel gestaucht wird, ist genau die
 * Aussage ("du liegst weit unter/über Kaufpreis").
 */
export function toChartScale(
  values: number[],
  width: number,
  height: number,
  padY = 0,
  extraDomain: number[] = [],
): ChartScale {
  const domain = [...values, ...extraDomain];
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const range = max - min || 1;
  const innerHeight = height - 2 * padY;

  const valueToY = (value: number) => padY + (1 - (value - min) / range) * innerHeight;

  return {
    coords: values.map((v, i) => ({ x: (i / (values.length - 1)) * width, y: valueToY(v) })),
    valueToY,
  };
}

/** Kurzform von `toChartScale` für Aufrufer ohne Referenzwert. */
export function toChartCoords(
  values: number[],
  width: number,
  height: number,
  padY = 0,
): ChartPoint[] {
  return toChartScale(values, width, height, padY).coords;
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

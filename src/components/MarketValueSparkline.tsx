import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import type { MarketValuePoint } from '@/api/kickbase';
import { useElementSize } from '@/hooks/useElementSize';
import { nearestIndex, toChartCoords } from '@/utils/chart';
import { formatCurrency, formatDelta, formatMarketValueDate } from '@/utils/format';
import styles from './MarketValueSparkline.module.css';

interface MarketValueSparklineProps {
  points: MarketValuePoint[];
  height?: number;
}

const BUBBLE_WIDTH = 150;
const PAD_Y = 8;
/** Waagerechter Weg, ab dem aus einem Tippen ein Scrubben wird (vorher `activeOffsetX`). */
const ACTIVATION_X = 8;

/** Kleiner SVG-Polyline-Chart für den Marktwertverlauf — kein Chart-Paket nötig. */
export function MarketValueSparkline({ points, height = 120 }: MarketValueSparklineProps) {
  const [chartRef, { width }] = useElementSize();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gesture = useRef<{ startX: number; active: boolean } | null>(null);

  const values = points.map((p) => p.value);
  const trendUp = values.length > 0 && values[values.length - 1]! >= values[0]!;

  const coords = useMemo(
    () => (points.length >= 2 ? toChartCoords(values, width, height, PAD_Y) : []),
    // `values.join(',')` als Dep statt `values`: das Array ist bei jedem
    // Render neu, sein Inhalt aber meist gleich.
    //
    // Hier stand ein `eslint-disable-next-line react-hooks/exhaustive-deps`.
    // Das Repo hat keinen Linter — die Zeile unterdrückte also nichts und
    // sah nur so aus, als täte sie es. Die Absicht bleibt als Kommentar.
    [values.join(','), width, height],
  );

  /**
   * Scrubbing über Pointer Events statt einer Pan-Gesture. Die Zuordnung ist
   * exakt: `touch-action: pan-y` im CSS überlässt dem Browser das senkrechte
   * Scrollen (= `failOffsetY`, er schickt dann ein `pointercancel`), und die
   * 8px-Schwelle unten ist `activeOffsetX`. Genau die dokumentierte Absicht —
   * waagerechtes Scrubben darf das Seiten-Scrollen nicht blockieren.
   */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    gesture.current = { startX: event.clientX, active: false };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = gesture.current;
    if (!state) return;

    if (!state.active) {
      if (Math.abs(event.clientX - state.startX) < ACTIVATION_X) return;
      state.active = true;
      // Hält die weiteren Events beim Container, auch wenn der Finger ihn
      // verlässt — das Gegenstück zum Gesture-Responder.
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setActiveIndex(nearestIndex(event.clientX - rect.left, rect.width, points.length));
  }

  function endGesture() {
    gesture.current = null;
    setActiveIndex(null);
  }

  if (points.length < 2) {
    return <div ref={chartRef} className={styles.empty} style={{ height }} />;
  }

  const clampedIndex = activeIndex === null ? null : Math.min(activeIndex, points.length - 1);
  const activePoint = clampedIndex === null ? null : points[clampedIndex]!;
  const activeCoord = clampedIndex === null ? null : coords[clampedIndex]!;
  const delta =
    clampedIndex !== null && clampedIndex > 0
      ? activePoint!.value - points[clampedIndex - 1]!.value
      : null;

  const bubbleLeft = activeCoord
    ? Math.min(Math.max(activeCoord.x - BUBBLE_WIDTH / 2, 0), Math.max(width - BUBBLE_WIDTH, 0))
    : 0;
  const last = coords[coords.length - 1]!;

  return (
    <div className={styles.container} data-trend={trendUp ? 'up' : 'down'}>
      {/* Fester Platz über dem Chart, damit das Auftauchen der Blase den Chart
          nicht verschiebt. */}
      <div className={styles.labelSlot}>
        {activePoint && (
          <div
            className={styles.bubble}
            style={{ left: bubbleLeft, width: BUBBLE_WIDTH } as CSSProperties}
          >
            <span className={styles.bubbleDate}>{formatMarketValueDate(activePoint.date)}</span>
            <span className={styles.bubbleValueRow}>
              <span className={styles.bubbleValue}>{formatCurrency(activePoint.value)}</span>
              {delta !== null && (
                <span
                  className={styles.bubbleDelta}
                  data-delta={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}
                >
                  {formatDelta(delta)}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div
        ref={chartRef}
        className={styles.chart}
        style={{ height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {width > 0 && (
          <svg width={width} height={height} aria-hidden="true">
            <polyline
              className={styles.line}
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
            {activeCoord && (
              <>
                <line
                  className={styles.crosshair}
                  x1={activeCoord.x}
                  y1={0}
                  x2={activeCoord.x}
                  y2={height}
                />
                <circle className={styles.scrubDot} cx={activeCoord.x} cy={activeCoord.y} r={5} />
              </>
            )}
            <circle className={styles.endDot} cx={last.x} cy={last.y} r={3} />
          </svg>
        )}
      </div>
    </div>
  );
}

import * as Haptics from 'expo-haptics';
import { useId, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon, Polyline, Rect } from 'react-native-svg';
import type { MarketValuePoint } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { nearestIndex, toChartScale } from '@/utils/chart';
import { formatCurrency, formatDelta, formatMarketValueDate } from '@/utils/format';

interface MarketValueSparklineProps {
  points: MarketValuePoint[];
  height?: number;
  /**
   * Referenzwert (heute: der Kaufpreis). Gesetzt = gestrichelte Linie auf
   * dieser Höhe, Fläche zwischen Kurve und Linie grün darüber / rot darunter.
   * Fehlt der Wert, rendert der Chart exakt wie vorher.
   */
  referenceValue?: number | null;
}

const LABEL_SLOT_HEIGHT = 40;
const BUBBLE_WIDTH = 150;
const PAD_Y = 8;

/** Kleiner SVG-Polyline-Chart für den Marktwertverlauf — kein Chart-Paket nötig. */
export function MarketValueSparkline({ points, height = 120, referenceValue }: MarketValueSparklineProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);
  // Clip-IDs müssen dokumentweit eindeutig sein — auf react-native-web ist das
  // echtes DOM. Reacts IDs sehen aus wie ":r3:", und `url(#:r3:)` ist keine
  // gültige Referenz; die Doppelpunkte müssen raus.
  const clipId = useId().replace(/:/g, '');

  const values = points.map((p) => p.value);
  const reference = referenceValue ?? null;
  // Mit Referenzlinie kodieren die Flächen grün/rot bereits "über/unter
  // Kaufpreis". Ein zusätzlich grün/rot eingefärbter Strich (Trend seit dem
  // ersten Punkt) würde dieselben Farben mit anderer Bedeutung belegen.
  const trendUp = values.length > 0 && values[values.length - 1]! >= values[0]!;
  const lineColor =
    reference !== null ? colors.textPrimary : trendUp ? colors.positive : colors.negative;

  const scale = useMemo(
    () =>
      points.length >= 2
        ? toChartScale(values, width, height, PAD_Y, reference === null ? [] : [reference])
        : { coords: [], valueToY: () => 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.join(','), width, height, reference],
  );
  const coords = scale.coords;

  const updateIndex = (x: number) => {
    const index = nearestIndex(x, width, points.length);
    if (lastHapticIndex.current !== index) {
      lastHapticIndex.current = index;
      void Haptics.selectionAsync();
    }
    setActiveIndex(index);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onStart((e) => updateIndex(e.x))
        .onUpdate((e) => updateIndex(e.x))
        .onFinalize(() => {
          setActiveIndex(null);
          lastHapticIndex.current = null;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, points.length],
  );

  if (points.length < 2) {
    return <View style={[styles.empty, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} />;
  }

  const clampedIndex = activeIndex === null ? null : Math.min(activeIndex, points.length - 1);
  const activePoint = clampedIndex === null ? null : points[clampedIndex]!;
  const activeCoord = clampedIndex === null ? null : coords[clampedIndex]!;
  const delta = clampedIndex !== null && clampedIndex > 0 ? activePoint!.value - points[clampedIndex - 1]!.value : null;

  const referenceY = reference === null ? null : scale.valueToY(reference);
  // Ein einziges Polygon: Kurve, dann an beiden Enden auf die Referenzlinie
  // heruntergezogen. Wo die Kurve die Linie kreuzt, überschlägt sich das
  // Polygon — mit der SVG-Standardregel `nonzero` füllen beide Lappen. Das
  // Aufteilen in "über"/"unter" übernimmt danach der Clip, exakt und ohne die
  // Schnittpunkte selbst ausrechnen zu müssen.
  const areaPoints =
    referenceY === null
      ? null
      : [
          `${coords[0]!.x},${referenceY}`,
          ...coords.map((c) => `${c.x},${c.y}`),
          `${coords[coords.length - 1]!.x},${referenceY}`,
        ].join(' ');

  const bubbleLeft = activeCoord ? Math.min(Math.max(activeCoord.x - BUBBLE_WIDTH / 2, 0), Math.max(width - BUBBLE_WIDTH, 0)) : 0;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.labelSlot}>
        {activePoint && (
          <View style={[styles.bubble, { left: bubbleLeft, width: BUBBLE_WIDTH }]} pointerEvents="none">
            <Text style={styles.bubbleDate}>{formatMarketValueDate(activePoint.date)}</Text>
            <View style={styles.bubbleValueRow}>
              <Text style={styles.bubbleValue}>{formatCurrency(activePoint.value)}</Text>
              {delta !== null && (
                <Text style={[styles.bubbleDelta, { color: delta > 0 ? colors.positive : delta < 0 ? colors.negative : colors.textMuted }]}>
                  {formatDelta(delta)}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
      <GestureDetector gesture={pan}>
        <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={height}>
              {areaPoints !== null && referenceY !== null && (
                <>
                  <Defs>
                    <ClipPath id={`${clipId}-above`}>
                      <Rect x={0} y={0} width={width} height={referenceY} />
                    </ClipPath>
                    <ClipPath id={`${clipId}-below`}>
                      <Rect x={0} y={referenceY} width={width} height={height - referenceY} />
                    </ClipPath>
                  </Defs>
                  {/* Clip am <G>, nicht an der Form selbst — die Variante, die
                      auf Android zuverlässig greift. */}
                  <G clipPath={`url(#${clipId}-above)`}>
                    <Polygon points={areaPoints} fill={colors.positive} fillOpacity={0.2} />
                  </G>
                  <G clipPath={`url(#${clipId}-below)`}>
                    <Polygon points={areaPoints} fill={colors.negative} fillOpacity={0.2} />
                  </G>
                  {/* Nach den Flächen gezeichnet: deckt zugleich die Naht
                      zwischen den beiden Clip-Rechtecken ab. Bewusst anderer
                      Strich als das Scrub-Fadenkreuz (border, "3 3"). */}
                  <Line
                    x1={0}
                    y1={referenceY}
                    x2={width}
                    y2={referenceY}
                    stroke={colors.textSecondary}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </>
              )}
              <Polyline
                points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {activeCoord && (
                <>
                  <Line
                    x1={activeCoord.x}
                    y1={0}
                    x2={activeCoord.x}
                    y2={height}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <Circle cx={activeCoord.x} cy={activeCoord.y} r={5} fill={colors.background} stroke={lineColor} strokeWidth={2} />
                </>
              )}
              <Circle cx={coords[coords.length - 1]!.x} cy={coords[coords.length - 1]!.y} r={3} fill={lineColor} />
            </Svg>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
  },
  labelSlot: {
    height: LABEL_SLOT_HEIGHT,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 2,
  },
  bubbleDate: {
    ...typography.small,
    color: colors.textSecondary,
  },
  bubbleValueRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'baseline',
  },
  bubbleValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bubbleDelta: {
    ...typography.small,
  },
});

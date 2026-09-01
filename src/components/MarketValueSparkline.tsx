import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import type { MarketValuePoint } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { nearestIndex, toChartCoords } from '@/utils/chart';
import { formatCurrency, formatDelta, formatMarketValueDate } from '@/utils/format';

interface MarketValueSparklineProps {
  points: MarketValuePoint[];
  height?: number;
}

const LABEL_SLOT_HEIGHT = 40;
const BUBBLE_WIDTH = 150;
const PAD_Y = 8;

/** Kleiner SVG-Polyline-Chart für den Marktwertverlauf — kein Chart-Paket nötig. */
export function MarketValueSparkline({ points, height = 120 }: MarketValueSparklineProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);

  const values = points.map((p) => p.value);
  const trendUp = values.length > 0 && values[values.length - 1]! >= values[0]!;
  const lineColor = trendUp ? colors.positive : colors.negative;

  const coords = useMemo(
    () => (points.length >= 2 ? toChartCoords(values, width, height, PAD_Y) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.join(','), width, height],
  );

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

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { colors, spacing } from '@/theme/tokens';
import { PlayerCard } from './PlayerCard';

interface PitchProps {
  /** Nur Spieler mit inLineup === true. */
  players: SquadPlayer[];
  onSelectPlayer?: (player: SquadPlayer) => void;
  /** Vom Optimizer neu aufgestellte Spieler — bekommen einen Akzent-Rahmen. */
  changedIds?: ReadonlySet<string>;
}

const ROW_ORDER: Position[] = ['FWD', 'MID', 'DEF', 'GK'];

/**
 * Reihen werden aus den tatsächlichen Aufstellungsspielern gebildet (gruppiert
 * nach `position`), nicht aus dem geparsten Formationsstring — die echten
 * Daten sind die verlässlichere Quelle als eine hergeleitete Zählung.
 */
export function Pitch({ players, onSelectPlayer, changedIds }: PitchProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const rows = ROW_ORDER.map((position) => ({
    position,
    players: players
      .filter((p) => p.position === position)
      .sort((a, b) => (a.lineupSlot ?? 0) - (b.lineupSlot ?? 0)),
  })).filter((row) => row.players.length > 0);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={colors.pitch} />
          <Line
            x1={0}
            y1={size.height / 2}
            x2={size.width}
            y2={size.height / 2}
            stroke={colors.pitchLine}
            strokeWidth={1}
          />
          <Circle
            cx={size.width / 2}
            cy={size.height / 2}
            r={size.width * 0.16}
            stroke={colors.pitchLine}
            strokeWidth={1}
            fill="none"
          />
          {/* Strafraum unten (eigenes Tor) */}
          <Rect
            x={size.width * 0.22}
            y={size.height - size.height * 0.12}
            width={size.width * 0.56}
            height={size.height * 0.12}
            stroke={colors.pitchLine}
            strokeWidth={1}
            fill="none"
          />
          {/* Strafraum oben (gegnerisches Tor) */}
          <Rect
            x={size.width * 0.22}
            y={0}
            width={size.width * 0.56}
            height={size.height * 0.12}
            stroke={colors.pitchLine}
            strokeWidth={1}
            fill="none"
          />
        </Svg>
      )}

      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.position} style={styles.row}>
            {row.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onPress={onSelectPlayer}
                backgroundColor={colors.pitch}
                changed={changedIds?.has(player.id)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: 16,
    overflow: 'hidden',
  },
  rows: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
});

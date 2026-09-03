import { StyleSheet, Text, View } from 'react-native';
import type { SquadPlayer } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatDelta, formatMinutes } from '@/utils/format';
import { formatMetric, metricLabels, type PlayerMetric } from '@/utils/playerMetric';
import type { PlaytimeTotals } from '@/utils/playtime';
import type { StatCell } from './PlayerRowFrame';
import { PlayerRowFrame, PlayerStatColumn } from './PlayerRowFrame';
import { StatusBadge } from './StatusBadge';
import { TeamLogo } from './TeamLogo';

interface PlayerRowProps {
  player: SquadPlayer;
  /** Kennzahl unter dem Marktwert — folgt der aktiven Sortierung der Kaderliste. */
  metric: PlayerMetric;
  /** Nur gesetzt, wenn `metric === 'pointsPerMinute'` und der Request durch ist. */
  playtime?: PlaytimeTotals;
  onPress?: (player: SquadPlayer) => void;
}

/** Eine Zeile der Kaderliste (siehe SquadList): Position, Bild, Name, Marktwert, aktive Kennzahl, Status. */
export function PlayerRow({ player, metric, playtime, onPress }: PlayerRowProps) {
  // Der Marktwert steht schon als Anker in Zeile 1 — eine zweite identische
  // Zahl wäre Rauschen, deshalb fällt diese Kennzahl auf Ø Punkte zurück.
  const secondary = metric === 'marketValue' ? 'avgPoints' : metric;

  const cells: StatCell[] = [{ value: formatCurrency(player.marketValue) }];
  if (player.marketValueChangeToday !== 0) {
    cells.push({
      value: formatDelta(player.marketValueChangeToday),
      tone: player.marketValueChangeToday > 0 ? 'positive' : 'negative',
    });
  }
  cells.push({ value: formatMetric(player, secondary, playtime), label: metricLabels[secondary].cell });

  return (
    <PlayerRowFrame
      position={player.position}
      imageUrl={player.imageUrl}
      onPress={() => onPress?.(player)}
      right={<PlayerStatColumn cells={cells} />}
    >
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        {player.inLineup && <View style={styles.lineupDot} />}
      </View>
      <View style={styles.metaRow}>
        <StatusBadge status={player.status} />
        {player.nextMatch && <NextMatchTag player={player} />}
        {/* Spielzeit als Einordnung neben P/Min — 2,45 P/Min aus 8' ist Rauschen, aus 500' nicht. */}
        {playtime && <Text style={styles.playtimeText}>{formatMinutes(playtime.minutes)}</Text>}
        {player.onMarket && (
          <View style={styles.marketTag}>
            <Text style={styles.marketTagText}>
              Gelistet{player.offerCount > 0 ? ` · ${player.offerCount}` : ''}
            </Text>
          </View>
        )}
      </View>
    </PlayerRowFrame>
  );
}

/** Gegner-Logo + H/A des nächsten Spiels — aus `SquadPlayer.nextMatch`. */
function NextMatchTag({ player }: { player: SquadPlayer }) {
  const match = player.nextMatch;
  if (!match) return null;
  const isHome = match.homeTeamId === player.teamId;
  const opponentLogoUrl = isHome ? match.awayLogoUrl : match.homeLogoUrl;
  return (
    <View style={styles.nextMatchTag}>
      <Text style={styles.nextMatchText}>{isHome ? 'H' : 'A'}</Text>
      <TeamLogo uri={opponentLogoUrl} size={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  lineupDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nextMatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  nextMatchText: {
    ...typography.small,
    color: colors.textMuted,
  },
  playtimeText: {
    ...typography.small,
    color: colors.textMuted,
  },
  marketTag: {
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
  },
  marketTagText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
});

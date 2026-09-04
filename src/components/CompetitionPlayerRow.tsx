import { StyleSheet, Text, View } from 'react-native';
import type { CompetitionPlayer } from '@/api/kickbase';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCurrency, formatMinutes } from '@/utils/format';
import { formatMetric, metricLabels, type PlayerMetric } from '@/utils/playerMetric';
import type { PlayerOrigin } from '@/utils/playerOwnership';
import type { PlaytimeTotals } from '@/utils/playtime';
import type { StatCell } from './PlayerRowFrame';
import { PlayerRowFrame, PlayerStatColumn } from './PlayerRowFrame';
import { StatusBadge } from './StatusBadge';
import { TeamLogo } from './TeamLogo';

interface CompetitionPlayerRowProps {
  player: CompetitionPlayer;
  /** Kennzahl unter dem Marktwert — folgt der aktiven Sortierung im Spieler-Tab. */
  metric: PlayerMetric;
  /** Verein aus `useCompetitionTeams` — der Bestand spannt alle 18, anders als Kader und Markt. */
  teamName?: string;
  teamLogoUrl?: string | null;
  /** Fehlt, wenn der Spieler weder mir gehört noch gelistet ist (der Normalfall). */
  origin?: PlayerOrigin;
  /** Nur gesetzt, wenn nach Punkte/Min sortiert wird und der Request durch ist. */
  playtime?: PlaytimeTotals;
  onPress?: (player: CompetitionPlayer) => void;
}

/**
 * Eine Zeile im Spieler-Tab. Aufstellungs- und Tagesänderungs-Angaben fehlen
 * hier, weil der competition-weite Bestand sie nicht liefert (siehe
 * CompetitionPlayer); dafür kommen Verein und Herkunftshinweis dazu — bei
 * ~500 Spielern ist „gehört mir“ bzw. „ist zu haben“ die Information, nach
 * der man sucht.
 */
export function CompetitionPlayerRow({
  player,
  metric,
  teamName,
  teamLogoUrl,
  origin,
  playtime,
  onPress,
}: CompetitionPlayerRowProps) {
  // Der Marktwert steht schon als Anker in Zeile 1 — eine zweite identische
  // Zahl wäre Rauschen, deshalb fällt diese Kennzahl auf Ø Punkte zurück.
  const secondary = metric === 'marketValue' ? 'avgPoints' : metric;

  const cells: StatCell[] = [
    { value: formatCurrency(player.marketValue) },
    { value: formatMetric(player, secondary, playtime), label: metricLabels[secondary].cell },
  ];

  return (
    <PlayerRowFrame
      position={player.position}
      imageUrl={player.imageUrl}
      onPress={() => onPress?.(player)}
      right={<PlayerStatColumn cells={cells} />}
    >
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.metaRow}>
        <StatusBadge status={player.status} />
        {/* Logo nur zusammen mit dem Namen: ein Logo ohne Verein ist bei
            fehlender Teamliste nur ein grauer Platzhalter. */}
        {teamName && (
          <>
            <TeamLogo uri={teamLogoUrl ?? null} size={14} />
            <Text style={styles.teamName} numberOfLines={1}>
              {teamName}
            </Text>
          </>
        )}
        {/* Spielzeit als Einordnung neben P/Min — 2,45 P/Min aus 8' ist Rauschen, aus 500' nicht. */}
        {playtime && <Text style={styles.playtimeText}>{formatMinutes(playtime.minutes)}</Text>}
        {origin?.mine && (
          <View style={styles.originTag}>
            <Text style={styles.originTagText}>Mein Kader</Text>
          </View>
        )}
        {origin?.onMarket && (
          <View style={styles.originTag}>
            <Text style={styles.originTagText}>Gelistet</Text>
          </View>
        )}
      </View>
    </PlayerRowFrame>
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  teamName: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },
  playtimeText: {
    ...typography.small,
    color: colors.textMuted,
  },
  originTag: {
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
  },
  originTagText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
});

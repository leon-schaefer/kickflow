import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { FixtureDifficultyRating } from '@/utils/fixtureDifficulty';
import { TeamLogo } from './TeamLogo';

interface FixtureDifficultyStripProps {
  ratings: readonly FixtureDifficultyRating[];
  /** 'attack' = schwer fürs eigene Stürmer/Mittelfeld, 'defense' = schwer für Abwehr/Torwart. */
  lens: 'attack' | 'defense';
  size?: number;
  /**
   * true = jede Zelle zeigt zusätzlich das Vereinslogo des Gegners (aus dem
   * Spielplan, siehe UpcomingFixture.opponentLogoUrl). Im Restprogramm aus,
   * weil dort der Verein schon links in der Zeile steht und die Zellen mit
   * 10 Spielen zu klein dafür sind.
   */
  showOpponentLogos?: boolean;
}

/**
 * Reihe farbcodierter Spiele — je Partie H/A + Härte. Geteilt zwischen dem
 * Restprogramm-Screen (app/(app)/[leagueId]/fixtures.tsx) und dem "Nächste
 * Gegner"-Streifen auf dem Spieler-Detail, damit die Farbstufen an beiden
 * Stellen garantiert gleich aussehen.
 */
export function FixtureDifficultyStrip({ ratings, lens, size = 24, showOpponentLogos = false }: FixtureDifficultyStripProps) {
  return (
    <View style={styles.row}>
      {ratings.map((rating, index) => {
        const value = lens === 'attack' ? rating.attackDifficulty : rating.defenseDifficulty;
        return (
          <View
            key={index}
            style={[
              styles.cell,
              { width: size, height: size, backgroundColor: difficultyBackground(value), borderColor: difficultyBorder(value) },
            ]}
          >
            {showOpponentLogos && <TeamLogo uri={rating.opponentLogoUrl} size={Math.round(size * 0.5)} />}
            <Text style={styles.cellText}>{rating.isHome ? 'H' : 'A'}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Drei feste Stufen statt eines Farbverlaufs — dieselbe Diskret-statt-Gradient-Sprache wie StatusBadge/positionColors. */
function difficultyBackground(value: number): string {
  if (value < 0.4) return `${colors.positive}26`;
  if (value > 0.6) return `${colors.negative}26`;
  return colors.surfaceRaised;
}

function difficultyBorder(value: number): string {
  if (value < 0.4) return colors.positive;
  if (value > 0.6) return colors.negative;
  return colors.border;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});

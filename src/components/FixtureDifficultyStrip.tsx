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
   * true = die Zelle wird vom Vereinslogo des Gegners gefüllt (aus dem
   * Spielplan, siehe UpcomingFixture.opponentLogoUrl), das H/A sitzt dann nur
   * noch klein in der oberen rechten Ecke. Im Restprogramm aus, weil dort der
   * Verein schon links in der Zeile steht und die Zellen mit 10 Spielen zu
   * klein für ein erkennbares Logo sind.
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
            {showOpponentLogos ? (
              <>
                <TeamLogo uri={rating.opponentLogoUrl} size={Math.round(size * 0.8)} />
                <Text style={[styles.cellText, styles.venueBadge]}>{rating.isHome ? 'H' : 'A'}</Text>
              </>
            ) : (
              <Text style={styles.cellText}>{rating.isHome ? 'H' : 'A'}</Text>
            )}
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
  /** Mit Logo ist das H/A nur noch Beiwerk: klein oben rechts über die Ecke gelegt. */
  venueBadge: {
    position: 'absolute',
    top: 0,
    right: 1,
    fontSize: 9,
    lineHeight: 11,
    paddingHorizontal: 1,
    borderRadius: radius.sm,
    // Eigener Hintergrund, damit das H/A auch über einem hellen Logo lesbar bleibt.
    backgroundColor: colors.background,
  },
});

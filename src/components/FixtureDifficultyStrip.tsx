import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme/tokens';
import type { FixtureDifficultyRating } from '@/utils/fixtureDifficulty';
import { TeamLogo } from './TeamLogo';

interface FixtureDifficultyStripProps {
  ratings: readonly FixtureDifficultyRating[];
  /** 'attack' = schwer fürs eigene Stürmer/Mittelfeld, 'defense' = schwer für Abwehr/Torwart. */
  lens: 'attack' | 'defense';
  /** Kantenlänge einer Zelle — mit `fitWidth` nur die Obergrenze. */
  size?: number;
  /**
   * true = die Zelle wird vom Vereinslogo des Gegners gefüllt (aus dem
   * Spielplan, siehe UpcomingFixture.opponentLogoUrl), das H/A sitzt dann nur
   * noch klein in der oberen rechten Ecke. Im Restprogramm aus, weil dort der
   * Verein schon links in der Zeile steht und die Zellen mit 10 Spielen zu
   * klein für ein erkennbares Logo sind.
   */
  showOpponentLogos?: boolean;
  /**
   * true = der Streifen füllt die Restbreite seiner Zeile und schrumpft die
   * Zellen so, dass alle Spiele hineinpassen. Nötig im Restprogramm: 10 Spiele
   * à `size` sind breiter als die Spalte, und ohne Schrumpfen liefen die
   * Rechtecke über den Durchschnittswert rechts. Nur in einer Zeile (row)
   * verwenden — in einer Spalte würde das `flex: 1` die Höhe strecken.
   */
  fitWidth?: boolean;
}

/**
 * Reihe farbcodierter Spiele — je Partie H/A + Härte. Geteilt zwischen dem
 * Restprogramm-Screen (app/(app)/[leagueId]/fixtures.tsx) und dem "Nächste
 * Gegner"-Streifen auf dem Spieler-Detail, damit die Farbstufen an beiden
 * Stellen garantiert gleich aussehen.
 */
export function FixtureDifficultyStrip({
  ratings,
  lens,
  size = 24,
  showOpponentLogos = false,
  fitWidth = false,
}: FixtureDifficultyStripProps) {
  // 0 = noch nicht gemessen; bis zum ersten onLayout clippt styles.rowFill den
  // Streifen, statt ihn über den Nachbarn laufen zu lassen.
  const [availableWidth, setAvailableWidth] = useState(0);
  const gap = cellGap(ratings.length);
  const cellSize = fitWidth ? fittedCellSize(availableWidth, ratings.length, gap, size) : size;
  const showVenue = cellSize >= MIN_VENUE_CELL;

  return (
    <View
      style={[styles.row, { gap }, fitWidth && styles.rowFill]}
      onLayout={fitWidth ? (event: LayoutChangeEvent) => setAvailableWidth(event.nativeEvent.layout.width) : undefined}
    >
      {ratings.map((rating, index) => {
        const value = lens === 'attack' ? rating.attackDifficulty : rating.defenseDifficulty;
        return (
          <View
            key={index}
            style={[
              styles.cell,
              { width: cellSize, height: cellSize, backgroundColor: difficultyBackground(value), borderColor: difficultyBorder(value) },
            ]}
          >
            {showOpponentLogos ? (
              <>
                <TeamLogo uri={rating.opponentLogoUrl} size={Math.round(cellSize * 0.8)} />
                <Text style={[styles.cellText, styles.venueBadge]}>{rating.isHome ? 'H' : 'A'}</Text>
              </>
            ) : (
              showVenue && <Text style={[styles.cellText, venueFont(cellSize)]}>{rating.isHome ? 'H' : 'A'}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Unter dieser Kantenlänge bleibt nur die Farbfläche — ein H/A wäre dort nicht mehr lesbar. */
const MIN_VENUE_CELL = 12;

/** Bei vielen Spielen zählt jeder Punkt Zellbreite mehr als die Luft dazwischen. */
function cellGap(count: number): number {
  return count > 6 ? 2 : 4;
}

function fittedCellSize(availableWidth: number, count: number, gap: number, max: number): number {
  if (availableWidth <= 0 || count <= 0) return max;
  return Math.max(4, Math.min(max, Math.floor((availableWidth - gap * (count - 1)) / count)));
}

/** Zwei Stufen statt stufenloser Skalierung — dieselbe Diskret-statt-Gradient-Sprache wie die Farben. */
function venueFont(cellSize: number) {
  return cellSize >= 20 ? styles.venueFontFull : styles.venueFontTight;
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
  },
  rowFill: {
    flex: 1,
    // Yoga kennt kein `min-width: auto`: die Zeile darf unter ihre Inhaltsbreite
    // schrumpfen, und overflow schneidet ab, bis onLayout die Zellen passend macht.
    minWidth: 0,
    overflow: 'hidden',
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
  venueFontFull: {
    fontSize: typography.small.fontSize,
  },
  venueFontTight: {
    fontSize: 9,
    lineHeight: 11,
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

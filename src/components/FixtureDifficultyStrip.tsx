import type { CSSProperties } from 'react';
import type { FixtureDifficultyRating } from '@/utils/fixtureDifficulty';
import styles from './FixtureDifficultyStrip.module.css';
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
 * Restprogramm-Screen und dem "Nächste Gegner"-Streifen auf dem
 * Spieler-Detail, damit die Farbstufen an beiden Stellen garantiert gleich
 * aussehen.
 *
 * Die Farbe kommt über `data-difficulty` aus theme/positions.css. Vorher
 * lieferten zwei Hilfsfunktionen Hex-Strings, einer davon per
 * `${colors.positive}26` zusammengesetzt.
 */
export function FixtureDifficultyStrip({
  ratings,
  lens,
  size = 24,
  showOpponentLogos = false,
}: FixtureDifficultyStripProps) {
  return (
    <div className={styles.row} style={{ '--cell-size': `${size}px` } as CSSProperties}>
      {ratings.map((rating, index) => {
        const value = lens === 'attack' ? rating.attackDifficulty : rating.defenseDifficulty;
        return (
          <span key={index} className={styles.cell} data-difficulty={difficultyStep(value)}>
            {showOpponentLogos ? (
              <>
                <TeamLogo uri={rating.opponentLogoUrl} size={Math.round(size * 0.8)} />
                <span className={styles.venueBadge}>{rating.isHome ? 'H' : 'A'}</span>
              </>
            ) : (
              <span className={styles.venue}>{rating.isHome ? 'H' : 'A'}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Drei feste Stufen statt eines Farbverlaufs — die Schwellen sind unverändert. */
export function difficultyStep(value: number): 'easy' | 'neutral' | 'hard' {
  if (value < 0.4) return 'easy';
  if (value > 0.6) return 'hard';
  return 'neutral';
}

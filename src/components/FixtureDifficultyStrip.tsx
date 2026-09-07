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
  /**
   * Vereins-ID → Name, für die Textalternative jeder Zelle.
   *
   * Optional, weil der Spielplan die Namen nicht mitliefert (UpcomingFixture
   * trägt nur `opponentId` und `opponentLogoUrl`) — sie kommen aus der
   * Competition-Tabelle, die nicht jeder Aufrufer geladen hat. Ohne die Map
   * nennt das Label Spieltag, Heimrecht und Härte, nur nicht den Gegner.
   */
  opponentNames?: ReadonlyMap<string, string>;
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
 *
 * ## Warum jede Zelle ein `role="img"` mit Label ist
 *
 * Dieser Streifen war die einzige Stelle der App, an der Information
 * AUSSCHLIESSLICH über Farbe und Bild lief:
 *
 *   - Die Härte steckte nur in der Zellfarbe. Für jemanden mit Rot-Grün-Schwäche
 *     (rund 8 % der Männer) sind „leicht" und „schwer" hier dieselbe Zelle —
 *     ein Verstoß gegen WCAG 1.4.1 („Use of Color"), und einer, der die
 *     Kernaussage des Streifens trifft.
 *   - Der Gegner steckte nur im Logo, und das trug `alt=""`. Für einen
 *     Screenreader war eine Zelle damit das Wort „H" — zehnmal in einer Reihe.
 *
 * Das leere `alt` am Logo ist trotzdem richtig und bleibt: der Text steht
 * jetzt am `role="img"` der ZELLE, und die trägt beides — Gegner UND Härte.
 * Zwei Ansagen für dasselbe Bild wären schlechter als eine.
 *
 * `role="img"` macht die Kinder der Zelle für Hilfsmittel unsichtbar; das
 * „H"/„A" und das Logo werden also nicht zusätzlich vorgelesen, sondern durch
 * das Label ersetzt. Genau deshalb nennt das Label das Heimrecht in Worten
 * („Heimspiel" statt „H").
 */
export function FixtureDifficultyStrip({
  ratings,
  lens,
  size = 24,
  showOpponentLogos = false,
  opponentNames,
}: FixtureDifficultyStripProps) {
  return (
    <div className={styles.row} style={{ '--cell-size': `${size}px` } as CSSProperties}>
      {ratings.map((rating, index) => {
        const value = lens === 'attack' ? rating.attackDifficulty : rating.defenseDifficulty;
        const step = difficultyStep(value);
        return (
          <span
            key={index}
            className={styles.cell}
            data-difficulty={step}
            role="img"
            aria-label={fixtureLabel(rating, step, opponentNames?.get(rating.opponentId))}
          >
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
  if (value <= 0.6) return 'neutral';
  return 'hard';
}

/**
 * Die Härte in Worten — dieselben drei Stufen wie `difficultyStep`, nur
 * vorlesbar.
 *
 * Bezieht sich auf die eigene Mannschaft und nicht auf den Gegner: „schwer"
 * heißt „schwer FÜR UNS". Ohne diesen Bezug wäre das Wort in der defensiven
 * Linse verwirrend, wo ein starker Gegner die eigene Abwehr betrifft.
 */
const DIFFICULTY_WORDS: Record<ReturnType<typeof difficultyStep>, string> = {
  easy: 'leicht',
  neutral: 'mittel',
  hard: 'schwer',
};

export function fixtureLabel(
  rating: Pick<FixtureDifficultyRating, 'day' | 'isHome'>,
  step: ReturnType<typeof difficultyStep>,
  opponentName?: string,
): string {
  const venue = rating.isHome ? 'Heimspiel' : 'Auswärtsspiel';
  // Ohne Namen bleibt der Gegner ungenannt statt als „gegen Team 7"
  // vorgelesen zu werden — eine ID ist keine Auskunft.
  const against = opponentName ? ` gegen ${opponentName}` : '';
  return `Spieltag ${rating.day}, ${venue}${against}, ${DIFFICULTY_WORDS[step]}`;
}

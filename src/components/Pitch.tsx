import type { CSSProperties } from 'react';
import type { Position, SquadPlayer } from '@/api/kickbase';
import styles from './Pitch.module.css';
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
 *
 * Die Linien zeichnet ein SVG mit festem `viewBox` statt gemessener Pixel: die
 * RN-Fassung wartete auf ein `onLayout`, um Breite und Höhe zu kennen, und
 * rechnete jede Koordinate daraus (`width * 0.16`, `height * 0.12`). Alle diese
 * Faktoren sind Anteile der Box — in viewBox-Einheiten also Konstanten. Damit
 * entfällt die Messung samt dem Frame, in dem das Feld noch leer war.
 *
 * `vector-effect: non-scaling-stroke` hält die Linien dabei 1px dünn, egal wie
 * groß das Feld skaliert; ohne das wäre eine viewBox-Einheit Strichbreite je
 * nach Bildschirm 4–5 Pixel.
 */
export function Pitch({ players, onSelectPlayer, changedIds }: PitchProps) {
  const rows = ROW_ORDER.map((position) => ({
    position,
    players: players
      .filter((p) => p.position === position)
      .sort((a, b) => (a.lineupSlot ?? 0) - (b.lineupSlot ?? 0)),
  })).filter((row) => row.players.length > 0);

  return (
    <div className={styles.container}>
      {/* Reine Dekoration — der Aufstellung fügt das Linienbild nichts hinzu,
          was nicht schon in den Karten steht. */}
      <svg className={styles.lines} viewBox="0 0 72 100" aria-hidden="true">
        <line x1={0} y1={50} x2={72} y2={50} />
        <circle cx={36} cy={50} r={72 * 0.16} />
        {/* Strafraum unten (eigenes Tor) und oben (gegnerisches Tor) */}
        <rect x={72 * 0.22} y={100 - 12} width={72 * 0.56} height={12} />
        <rect x={72 * 0.22} y={0} width={72 * 0.56} height={12} />
      </svg>

      <div className={styles.rows}>
        {rows.map((row) => (
          <div
            key={row.position}
            className={styles.row}
            // Die Reihe teilt ihre Breite durch die Zahl der Karten, damit
            // sechs Mittelfeldspieler (3-6-1) nicht über den Rasen
            // hinausragen — siehe --card-width in Pitch.module.css.
            style={{ '--slots': row.players.length } as CSSProperties}
          >
            {row.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={onSelectPlayer}
                changed={changedIds?.has(player.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Position, Team } from '@/api/kickbase';
import { positionLabels } from '@/theme/tokens';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { isPlayerFilterActive } from '@/utils/playerFilter';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './PlayerFilterBar.module.css';
import { TeamLogo } from './TeamLogo';
import { TextField } from './TextField';

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

interface PlayerFilterBarProps {
  criteria: PlayerFilterCriteria;
  onChange: (criteria: PlayerFilterCriteria) => void;
  /** Vereins-Chips nur, wenn Teams bekannt sind — auf einigen Screens (noch) nicht geladen. */
  teams?: Team[];
}

/**
 * Suche + Positions-/Status-/Vereins-Chips für Kader und Transfermarkt.
 * Reiner Presenter — die eigentliche Filterlogik steckt in `filterPlayers`
 * (src/utils/playerFilter.ts), damit sie ohne UI testbar bleibt.
 */
export function PlayerFilterBar({ criteria, onChange, teams }: PlayerFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const active = isPlayerFilterActive(criteria);

  function togglePosition(position: Position) {
    const positions = criteria.positions.includes(position)
      ? criteria.positions.filter((p) => p !== position)
      : [...criteria.positions, position];
    onChange({ ...criteria, positions });
  }

  function toggleFitOnly() {
    onChange({ ...criteria, statuses: criteria.statuses.includes('fit') ? [] : ['fit'] });
  }

  function toggleTeam(teamId: string) {
    const teamIds = criteria.teamIds.includes(teamId)
      ? criteria.teamIds.filter((id) => id !== teamId)
      : [...criteria.teamIds, teamId];
    onChange({ ...criteria, teamIds });
  }

  function clear() {
    onChange({ query: '', positions: [], statuses: [], teamIds: [] });
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchRow}>
        <TextField
          className={styles.search}
          inputClassName={styles.searchInput}
          type="search"
          placeholder="Spieler suchen…"
          aria-label="Spieler suchen"
          value={criteria.query}
          onChange={(query) => onChange({ ...criteria, query })}
          autoCorrect="off"
          autoCapitalize="none"
          clearLabel="Suche löschen"
        />
        <button
          type="button"
          className={cx(layout.pressable, styles.filterToggle)}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          Filter{active ? ` · ${filterCount(criteria)}` : ''}
        </button>
      </div>

      {expanded && (
        <div className={cx(styles.chipScroll, layout.noScrollbar)}>
          <div className={styles.chipRow} role="group" aria-label="Filter">
            {POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                // data-position + aria-pressed statt
                // `${positionColors[position]}26` im style-Array: die aktive
                // Farbe kommt aus theme/positions.css.
                data-position={position}
                aria-pressed={criteria.positions.includes(position)}
                className={cx(layout.pressable, styles.chip, styles.positionChip)}
                onClick={() => togglePosition(position)}
              >
                {positionLabels[position]}
              </button>
            ))}

            <span className={styles.chipDivider} />

            <button
              type="button"
              aria-pressed={criteria.statuses.includes('fit')}
              className={cx(layout.pressable, styles.chip)}
              onClick={toggleFitOnly}
            >
              Nur fit
            </button>

            {teams && teams.length > 0 && (
              <>
                <span className={styles.chipDivider} />
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    // Der Chip zeigt nur das Logo — ohne Label war er vorher
                    // für Screenreader ein namenloser Knopf.
                    aria-label={team.name}
                    aria-pressed={criteria.teamIds.includes(team.id)}
                    className={cx(layout.pressable, styles.teamChip)}
                    onClick={() => toggleTeam(team.id)}
                  >
                    <TeamLogo uri={team.logoUrl} size={16} />
                  </button>
                ))}
              </>
            )}

            {active && (
              <button
                type="button"
                className={cx(layout.pressable, styles.clearChip)}
                onClick={clear}
              >
                Zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function filterCount(criteria: PlayerFilterCriteria): number {
  return criteria.positions.length + criteria.statuses.length + criteria.teamIds.length;
}

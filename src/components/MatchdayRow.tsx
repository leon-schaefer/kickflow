import type { MatchdayPerformance } from '@/api/kickbase';
import { formatPoints } from '@/utils/format';
import { toFixtureView } from '@/utils/matchday';
import styles from './MatchdayRow.module.css';
import { TeamLogo } from './TeamLogo';

interface MatchdayRowProps {
  matchday: MatchdayPerformance;
  /** Fallback, falls `matchday.playerTeamId` ausnahmsweise leer ist — i.d.R. `PlayerDetail.teamId`. */
  playerTeamId: string;
  /** teamId → Name, aus `useCompetitionTeams()`. Unbekannte Gegner fallen auf "Team {id}" zurück. */
  teamNames: Map<string, string>;
}

/**
 * Ergebnis-Ton statt Farbwert: die drei Ausgänge werden auf die tone-Variablen
 * aus theme/positions.css abgebildet. Vorher stand hier eine Map auf
 * `colors.positive`/`colors.textSecondary`/`colors.negative`.
 */
const outcomeTones = {
  win: 'positive',
  draw: 'muted',
  loss: 'negative',
} as const;

export function MatchdayRow({ matchday, playerTeamId, teamNames }: MatchdayRowProps) {
  const fixture = toFixtureView(matchday, playerTeamId, teamNames);

  return (
    <div className={styles.row}>
      <span className={styles.matchdayLabel}>ST {matchday.matchday}</span>
      <span className={styles.venue}>{fixture.isHome ? 'H' : 'A'}</span>
      <span className={styles.opponent}>
        <TeamLogo uri={fixture.opponentLogoUrl} />
        <span className={styles.opponentName}>{fixture.opponentName}</span>
      </span>
      <span className={styles.score} data-tone={outcomeTones[fixture.outcome]}>
        {fixture.ownGoals}:{fixture.opponentGoals}
      </span>
      <span className={styles.minutes}>{matchday.minutesPlayed}&apos;</span>
      <span className={styles.points}>{formatPoints(matchday.points)} P</span>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { FixtureDifficultyStrip } from '@/components/FixtureDifficultyStrip';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { TeamLogo } from '@/components/TeamLogo';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCompetitionTeams, useMatchdays } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import {
  averageDifficulty,
  buildFixtureIndex,
  fixtureDifficulty,
  remainingFixtures,
  teamGoalRecord,
  teamStrength,
} from '@/utils/fixtureDifficulty';
import { resolveMatchdayState } from '@/utils/matchday';
import layout from '@/theme/layout.module.css';
import styles from './FixturesScreen.module.css';

type Lens = 'attack' | 'defense';
type Lookahead = 5 | 10;

const LENS_OPTIONS: { key: Lens; label: string }[] = [
  { key: 'attack', label: 'Angriff' },
  { key: 'defense', label: 'Abwehr' },
];

/**
 * Restprogramm/Gegner-Härte über die ganze Liga — nicht nur den eigenen
 * Kader. Erreichbar über die "Restprogramm"-Zeile im Liga-Header (siehe
 * LineupScreen). Keine eigene Datenquelle: derselbe Spielplan, den
 * useMatchdays ohnehin lädt (15 min Stale-Time), reduziert auf Tore-Bilanz —
 * siehe src/utils/fixtureDifficulty.ts für die Begründung, warum das ohne
 * einen neuen Kickbase-Endpoint auskommt.
 */
export function FixturesScreen() {
  const { leagueId = '' } = useParams<{ leagueId: string }>();
  const competitionId = useCompetitionId();
  const back = useBackTarget(leagueId);
  const matchdaysQuery = useMatchdays(competitionId);
  const teamsQuery = useCompetitionTeams(competitionId);
  const refresh = useRefresh(matchdaysQuery, teamsQuery);
  const [lens, setLens] = useState<Lens>('attack');
  const [lookahead, setLookahead] = useState<Lookahead>(5);

  const rows = useMemo(() => {
    if (!matchdaysQuery.data || !teamsQuery.data) return [];
    const schedule = matchdaysQuery.data;
    const fromDay =
      resolveMatchdayState(schedule, Date.now()).open?.day ?? schedule.currentDay ?? 1;
    const index = buildFixtureIndex(schedule);
    const strengths = teamStrength(teamGoalRecord(schedule));

    return teamsQuery.data
      .map((team) => {
        const upcoming = remainingFixtures(team.id, index, fromDay, lookahead);
        const ratings = fixtureDifficulty(upcoming, strengths);
        return { team, ratings, average: averageDifficulty(ratings) };
      })
      .filter((row) => row.ratings.length > 0)
      .sort((a, b) => a.average[lens] - b.average[lens]);
  }, [matchdaysQuery.data, teamsQuery.data, lookahead, lens]);

  // Ein Header für alle Zweige — unter expo-router musste der Zurück-Button
  // in jedem einzeln stehen, damit der Pfeil auch beim Laden beschriftet ist.
  const header = <AppHeader title="Restprogramm" back={back} />;

  if (!matchdaysQuery.data || !teamsQuery.data) {
    return (
      <>
        {header}
        <QueryState
          query={matchdaysQuery.data ? teamsQuery : matchdaysQuery}
          label="Restprogramm"
          refresh={refresh}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            <div className={styles.content}>
              <div className={styles.controlRow}>
                <div className={styles.segmentGroup} role="group" aria-label="Blickwinkel">
                  {LENS_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={lens === option.key}
                      className={cx(layout.pressable, styles.segmentChip)}
                      onClick={() => setLens(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className={styles.segmentGroup} role="group" aria-label="Vorausschau">
                  {([5, 10] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={lookahead === n}
                      className={cx(layout.pressable, styles.segmentChip)}
                      onClick={() => setLookahead(n)}
                    >
                      {n} Spiele
                    </button>
                  ))}
                </div>
              </div>

              <p className={styles.hint}>
                {lens === 'attack'
                  ? 'Wie schwer wird es für Stürmer/Mittelfeld, gegen die nächsten Gegner zu treffen — sortiert vom leichtesten Restprogramm.'
                  : 'Wie schwer wird es für Abwehr/Torwart, gegen die nächsten Gegner ohne Gegentor zu bleiben — sortiert vom leichtesten Restprogramm.'}
              </p>

              <ul className={styles.list}>
                {rows.map(({ team, ratings, average }) => (
                  <li key={team.id} className={styles.row}>
                    <span className={styles.teamCell}>
                      <TeamLogo uri={team.logoUrl} size={22} />
                      <span className={styles.teamName}>{team.name || `Team ${team.id}`}</span>
                    </span>
                    {/*
                     * Nur der Spielstreifen scrollt: Vereinsname links und
                     * Durchschnitt rechts bleiben stehen. Mit 10 Spielen ist der
                     * Streifen breiter als die Spalte.
                     */}
                    <span className={cx(styles.fixtureCells, layout.noScrollbar)}>
                      <FixtureDifficultyStrip ratings={ratings} lens={lens} />
                    </span>
                    <span className={styles.avgText}>{formatAverage(average[lens])}</span>
                  </li>
                ))}
              </ul>

              {rows.length === 0 && (
                <p className={styles.emptyText}>Noch kein Restprogramm verfügbar.</p>
              )}
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

function formatAverage(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

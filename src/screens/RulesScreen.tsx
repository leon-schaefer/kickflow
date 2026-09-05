import { useMemo } from 'react';
import { MaxPerTeamRuleCard } from '@/components/MaxPerTeamRuleCard';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, type MaxPerTeamRule } from '@/lineup/rules';
import { useCompetitionTeams, useLineup } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import { isAvailableForLineup } from '@/utils/lineupOptimizer';
import { countByTeam } from '@/utils/teamDistribution';
import styles from './RulesScreen.module.css';

/**
 * Liga-eigene Optimizer-Regeln. Erreichbar über die "Regeln"-Zeile in
 * OptimizerBar (Aufstellungs-Tab), als eigene Route neben player/:playerId —
 * nicht als Tab.
 */
export function RulesScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const league = useCurrentLeague();
  const back = useBackTarget(leagueId);
  const { rules, updateRule, loaded, leagueMax } = useLeagueRulesContext();
  const lineupQuery = useLineup(leagueId);
  const { data: lineup } = lineupQuery;
  const { data: teams } = useCompetitionTeams(competitionId);
  const refresh = useRefresh(lineupQuery);

  const teamNames = useMemo(
    () => new Map((teams ?? []).map((team) => [team.id, team.name])),
    [teams],
  );

  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;

  const players = lineup?.players ?? [];

  const teamRows = useMemo(() => countByTeam(players, teamNames), [players, teamNames]);

  // Nur einsatzfähige Spieler zählen für die Aufstellbar-Obergrenze — ein
  // verletzter Spieler bindet zwar einen Kaderplatz beim Verein, aber nie
  // einen Elf-Platz, egal was die Regel erlaubt.
  const startableCeiling = useMemo(() => {
    if (!maxPerTeamRule.enabled) return null;
    const counts = new Map<string, number>();
    for (const player of players) {
      if (!isAvailableForLineup(player.status)) continue;
      counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    }
    let total = 0;
    for (const count of counts.values()) total += Math.min(count, maxPerTeamRule.max);
    return Math.min(total, 11);
  }, [players, maxPerTeamRule]);

  return (
    <>
      <AppHeader title={league ? `Regeln · ${league.name}` : 'Regeln'} back={back} />
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            <div className={styles.content}>
              {/*
               * Erst nach dem Laden rendern: Bis dahin stünden hier die
               * DEFAULT_RULES (enabled: false), und ein Klick in diesem Fenster
               * würde vom nachziehenden Storage-Wert überschrieben — und
               * obendrein den falschen Stand persistieren (siehe
               * useLeagueRules.ts).
               */}
              {loaded && (
                <MaxPerTeamRuleCard
                  rule={maxPerTeamRule}
                  onChange={(patch) => updateRule('maxPerTeam', patch)}
                  leagueMax={leagueMax}
                />
              )}

              {teamRows.length > 0 && (
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}>Dein Kader</h2>
                  {teamRows.map((row) => {
                    const overLimit = maxPerTeamRule.enabled && row.count > maxPerTeamRule.max;
                    return (
                      <div key={row.teamId} className={styles.teamRow}>
                        <span className={styles.teamName}>{row.name}</span>
                        <span className={cx(styles.teamCount, overLimit && styles.teamCountOver)}>
                          {row.count} Spieler{overLimit ? ' · über Grenze' : ''}
                        </span>
                      </div>
                    );
                  })}
                  {startableCeiling !== null && (
                    <p className={styles.ceiling}>
                      Aufstellbar: höchstens {startableCeiling} von 11
                      {startableCeiling < 11 ? ' — engt die Formation ein' : ''}
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

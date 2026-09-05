import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { PlayerDetail, SquadPlayer } from '@/api/kickbase';
import { Pitch } from '@/components/Pitch';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, violatedRules, type MaxPerTeamRule } from '@/lineup/rules';
import {
  useCompetitionTeams,
  useLeagueRanking,
  useManagerLineup,
  useMatchdays,
} from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget, withOrigin } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import { formatCurrency, formatPoints } from '@/utils/format';
import type { LineupMatchday } from '@/utils/matchday';
import { resolveLineupMatchday, resolveMatchdayState } from '@/utils/matchday';
import { countByPosition, countByTeam } from '@/utils/teamDistribution';
import { pointsPerMillion } from '@/utils/valueScore';
import styles from './ManagerDetailScreen.module.css';

/**
 * Die Startelf eines Rivalen — Vereins-/Positionsverteilung plus Pitch-Ansicht.
 * Erreichbar durch Antippen einer Zeile im Liga-Tab. `lineupPlayerIds`
 * (aus `/leagues/{id}/ranking`) sind NUR die Startelf, nicht der ganze Kader
 * — Bankspieler eines Rivalen bleiben unsichtbar, das wird unten benannt.
 *
 * Die Elf kommt AUSDRÜCKLICH aus dem spieltagsbezogenen Ranking
 * (`?dayNumber=`), nicht aus der Saisonwertung: deren `lp[]` ist der Stand des
 * zuletzt abgerechneten Spieltags — also genau eine Runde zu alt. Welcher
 * Spieltag gefragt ist, entscheidet resolveLineupMatchday(): der laufende,
 * sonst der nächste offene. Gibt Kickbase dafür (noch) keine Elf heraus —
 * fremde Aufstellungen sind vor Anstoß nicht sichtbar —, fällt die Ansicht auf
 * die Saisonwertung zurück und sagt das in der Kopfzeile über dem Feld dazu.
 */
export function ManagerDetailScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const back = useBackTarget(leagueId);
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();

  const rankingQuery = useLeagueRanking(leagueId);
  const entry = rankingQuery.data?.entries.find((e) => e.userId === managerId) ?? null;

  const { data: competitionTeams } = useCompetitionTeams(competitionId);
  const teamNames = useMemo(
    () => new Map((competitionTeams ?? []).map((team) => [team.id, team.name])),
    [competitionTeams],
  );

  // Minutentakt, damit der Wechsel „offen → läuft" beim Anstoß von selbst
  // greift, ohne dass der Screen neu geöffnet werden muss. Kein Request:
  // resolveMatchdayState() rechnet nur auf dem längst geladenen Spielplan.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const matchdaysQuery = useMatchdays(competitionId);
  const lineupMatchday = matchdaysQuery.data
    ? resolveLineupMatchday(
        resolveMatchdayState(matchdaysQuery.data, Date.now()),
        matchdaysQuery.data.currentDay,
      )
    : null;
  // `lineupDay` als Primitive statt des Objekts: geht so unverändert in die
  // Query und in die Memo-Deps unten, ohne sie bei jedem Render zu kippen.
  const lineupDay = lineupMatchday?.day ?? null;
  const dayRankingQuery = useLeagueRanking(leagueId, lineupMatchday?.day, {
    enabled: lineupDay !== null,
    live: lineupMatchday?.phase === 'running',
  });

  // Nur EIN Memo für beides: `ids` muss über Renders hinweg stabil bleiben
  // (useManagerLineup feuert daraus eine Query je Spieler), und `fromDay`
  // hängt an derselben Entscheidung.
  const lineup = useMemo(() => {
    const seasonIds = entry?.lineupPlayerIds ?? [];
    // Ohne bekannten Spieltag zeigt `dayRankingQuery` (dayNumber === undefined)
    // dieselbe Saisonwertung wie oben — die dürfen wir dann NICHT als
    // spieltagsaktuell ausgeben.
    if (lineupDay === null) return { ids: seasonIds, fromDay: false };
    const dayRanking = dayRankingQuery.data;
    // Meldet die Antwort einen anderen Spieltag als den angefragten, hat
    // Kickbase `dayNumber` nicht berücksichtigt — dann ist ihre Elf nicht die
    // gesuchte, und die Kopfzeile soll das auch sagen.
    if (!dayRanking || (dayRanking.day !== null && dayRanking.day !== lineupDay)) {
      return { ids: seasonIds, fromDay: false };
    }
    const dayIds = dayRanking.entries.find((e) => e.userId === managerId)?.lineupPlayerIds ?? [];
    if (dayIds.some((id) => id !== null)) return { ids: dayIds, fromDay: true };
    return { ids: seasonIds, fromDay: false };
  }, [dayRankingQuery.data, entry, managerId, lineupDay]);

  const managerLineup = useManagerLineup(leagueId, lineup.ids);
  const refresh = useRefresh(rankingQuery, dayRankingQuery, matchdaysQuery, managerLineup);

  const players = useMemo(() => {
    const resolved: SquadPlayer[] = [];
    lineup.ids.forEach((playerId, index) => {
      if (!playerId) return;
      const detail = managerLineup.players.get(playerId);
      if (detail) resolved.push(toRivalSquadPlayer(detail, index));
    });
    return resolved;
  }, [lineup.ids, managerLineup.players]);

  const lineupLabel = describeLineupSource(
    lineupMatchday,
    lineup.fromDay,
    lineupDay !== null && dayRankingQuery.isPending,
  );

  const teamRows = useMemo(() => countByTeam(players, teamNames), [players, teamNames]);
  const positionRows = useMemo(() => countByPosition(players), [players]);
  const teamValue = useMemo(() => players.reduce((sum, p) => sum + p.marketValue, 0), [players]);
  const averagePoints =
    players.length > 0 ? players.reduce((sum, p) => sum + p.averagePoints, 0) / players.length : 0;

  // Liga-weite Regel (LeagueRulesProvider, siehe src/routes/LeagueLayout.tsx)
  // auch auf die Rivalen-Elf anwenden — sie gilt für jeden Manager gleich,
  // nicht nur für den eigenen Kader. `players` ist hier NUR die Startelf
  // (siehe Doc-Kommentar oben), ein Verstoß ist also ein echter Regelbruch in
  // dessen Aufstellung, keine bloße Kaderauffälligkeit.
  const { rules } = useLeagueRulesContext();
  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;
  const violations = useMemo(
    () =>
      violatedRules(
        rules,
        players,
        players.map((p) => p.id),
      ),
    [rules, players],
  );
  const violatesMaxPerTeam = violations.some((rule) => rule.kind === 'maxPerTeam');

  /**
   * Dieselbe Route wie aus dem eigenen Aufstellungs-Tab und dem Kader — ein
   * Spieler auf einem fremden Feld ist derselbe Spieler. Die Herkunft ist
   * bewusst DIESER Screen und nicht der Liga-Tab: Zurück soll auf die
   * Rivalen-Elf führen, aus der man kam.
   */
  function openPlayer(player: SquadPlayer) {
    navigate(
      `/${leagueId}/player/${player.id}`,
      withOrigin(`/${leagueId}/manager/${managerId}`, entry?.userName ?? 'Manager'),
    );
  }

  const header = <AppHeader title={entry?.userName ?? 'Manager'} back={back} />;

  if (!rankingQuery.data) {
    return (
      <>
        {header}
        <QueryState query={rankingQuery} label="Manager" refresh={refresh} />
      </>
    );
  }

  if (!entry) {
    return (
      <>
        {header}
        <div className={styles.center}>
          <p className={styles.emptyText}>Manager nicht gefunden.</p>
        </div>
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
              <dl className={styles.statsGrid}>
                <Stat label="Platz" value={entry.seasonPlace ? String(entry.seasonPlace) : '—'} />
                <Stat label="Saisonpunkte" value={formatPoints(entry.seasonPoints)} />
                <Stat label="Spieltagspunkte" value={formatPoints(entry.matchdayPoints)} />
                <Stat label="Teamwert (Liga)" value={formatCurrency(entry.teamValue)} />
              </dl>

              <div className={styles.lineupHeader}>
                <h2 className={styles.lineupTitle}>{lineupLabel.title}</h2>
                <p className={styles.lineupHint}>{lineupLabel.hint}</p>
                {players.length > 0 && (
                  <p className={styles.lineupHint}>Spieler antippen öffnet sein Profil.</p>
                )}
              </div>

              {managerLineup.pending > 0 && (
                <p className={styles.lineupHint}>
                  Elf wird geladen … {managerLineup.total - managerLineup.pending}/
                  {managerLineup.total}
                </p>
              )}

              {players.length > 0 && (
                <>
                  <Pitch players={players} onSelectPlayer={openPlayer} />

                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>Startelf-Kennzahlen</h3>
                    <p className={styles.cardLine}>
                      Marktwert der Startelf: {formatCurrency(teamValue)}
                    </p>
                    <p className={styles.cardLine}>
                      Ø-Punkte der Startelf: {formatPoints(Math.round(averagePoints))}
                    </p>
                  </section>

                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>Vereinsverteilung</h3>
                    {maxPerTeamRule.enabled && (
                      <p className={styles.ruleHint}>
                        Regel: max. {maxPerTeamRule.max} pro Verein
                      </p>
                    )}
                    {violatesMaxPerTeam && (
                      <p className={styles.ruleViolation}>
                        <span aria-hidden="true">⚠</span> Verletzt: Max. {maxPerTeamRule.max}{' '}
                        Spieler pro Verein
                      </p>
                    )}
                    {teamRows.map((row) => {
                      const overLimit = maxPerTeamRule.enabled && row.count > maxPerTeamRule.max;
                      return (
                        <div key={row.teamId} className={styles.distributionRow}>
                          <span className={styles.distributionName}>{row.name}</span>
                          <span
                            className={cx(
                              styles.distributionCount,
                              overLimit && styles.distributionCountOver,
                            )}
                          >
                            {row.count}
                            {overLimit ? ' · über Grenze' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </section>

                  <section className={styles.card}>
                    <h3 className={styles.cardTitle}>Positionsverteilung</h3>
                    {positionRows.map((row) => (
                      <div key={row.position} className={styles.distributionRow}>
                        <span className={styles.distributionName}>{row.position}</span>
                        <span className={styles.distributionCount}>{row.count}</span>
                      </div>
                    ))}
                  </section>
                </>
              )}

              <p className={styles.disclaimer}>
                Nur die Startelf ist sichtbar — die Kickbase-API liefert für andere Manager keinen
                Bankspieler.
              </p>
            </div>
          </div>
        )}
      </Refreshable>
    </>
  );
}

/**
 * Kopfzeile über dem Feld: welcher Spieltag da steht und wie verlässlich er
 * ist. Ohne diese Zeile ist eine fremde Elf nicht interpretierbar — vor Anstoß
 * gibt Kickbase Aufstellungen anderer Manager nicht heraus, dann bleibt
 * zwangsläufig der letzte abgerechnete Spieltag stehen (`fromDay === false`).
 */
function describeLineupSource(
  matchday: LineupMatchday | null,
  fromDay: boolean,
  loading: boolean,
): { title: string; hint: string } {
  if (!fromDay) {
    return {
      title: 'Startelf · letzter abgerechneter Spieltag',
      hint: !matchday
        ? 'Spielplan noch nicht geladen — Stand aus der Saisonwertung.'
        : loading
          ? `Spieltag ${matchday.day} wird geladen …`
          : `Für Spieltag ${matchday.day} gibt Kickbase noch keine Elf dieses Managers heraus.`,
    };
  }
  if (matchday?.phase === 'running') {
    return {
      title: `Startelf · Spieltag ${matchday.day} (läuft)`,
      hint: 'Live-Stand — aktualisiert sich jede Minute von selbst.',
    };
  }
  if (matchday?.phase === 'open') {
    return {
      title: `Startelf · Spieltag ${matchday.day}`,
      hint: 'Aufstellung für den kommenden Spieltag.',
    };
  }
  return {
    title: `Startelf · Spieltag ${matchday?.day ?? '—'}`,
    hint: 'Von Kickbase als aktueller Spieltag gemeldet.',
  };
}

/**
 * `PlayerDetail` (aus getPlayerBasic) → `SquadPlayer`, damit `Pitch`/`PlayerCard`
 * unverändert wiederverwendbar bleiben. Felder, die `PlayerDetail` nicht kennt
 * (Kader-/Marktkontext eines FREMDEN Managers — Kapitän, Bankstatus, eigenes
 * Gebot …), bekommen neutrale Defaults; `PlayerCard` liest sie ohnehin nicht.
 */
function toRivalSquadPlayer(detail: PlayerDetail, lineupSlot: number): SquadPlayer {
  return {
    id: detail.id,
    name: detail.lastName,
    firstName: detail.firstName,
    lastName: detail.lastName,
    position: detail.position,
    teamId: detail.teamId,

    marketValue: detail.marketValue,
    marketValueTrend: detail.marketValueTrend,
    marketValueChangeToday: 0,

    totalPoints: detail.totalPoints,
    averagePoints: detail.averagePoints,
    valueScoreAvg: pointsPerMillion(detail.averagePoints, detail.marketValue),
    valueScoreTotal: pointsPerMillion(detail.totalPoints, detail.marketValue),

    status: detail.status,
    statusDetails: detail.statusDetails,

    imageUrl: detail.imageUrl,
    teamLogoUrl: detail.teamLogoUrl,

    inLineup: true,
    lineupSlot,
    isCaptain: false,

    onMarket: false,
    offerCount: 0,

    nextMatch: null,
  };
}

/** Zahl über Bezeichnung — als Paar aus `<dt>`/`<dd>`, damit die Zuordnung nicht nur optisch ist. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dd className={styles.statValue}>{value}</dd>
      <dt className={styles.statLabel}>{label}</dt>
    </div>
  );
}

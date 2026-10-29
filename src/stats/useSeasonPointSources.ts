/**
 * Die Datenbeschaffung hinter dem Statistik-Screen — bewusst neben dem Screen
 * und nicht darin: der Screen zeigt Listen, dieser Hook baut die Elf-Historie
 * der Saison zusammen, und das ist der Teil mit den Fallstricken.
 *
 * Drei Quellen, die einzeln nichts taugen und zusammen die Frage beantworten
 * „wer hat MIR die Punkte gebracht" (siehe pointSources.ts):
 *
 *   1. der Spielplan → welche Spieltage sind überhaupt durch
 *   2. die Liga-Tabelle je Spieltag → meine Elf an genau diesem Tag
 *   3. `/performance` je Spieler → seine Punkte an genau diesem Tag
 */
import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import {
  useCompetitionTeams,
  useLineup,
  useMatchdayPoints,
  useMatchdayRankings,
  usePlayerBasics,
  useMatchdays,
} from '@/queries/hooks';
import { findOwnRankingEntry } from '@/utils/ownRankingEntry';
import type { MatchdayLineup, PointSource, StatsPlayerMeta } from './pointSources';
import { buildPointSources } from './pointSources';

export interface SeasonPointSources {
  sources: PointSource[];
  /** Vereins-ID → Name, für die Gruppierung nach Verein. */
  teamNames: Map<string, string>;
  /** Vereins-ID → Logo, für dieselben Zeilen. */
  teamLogos: Map<string, string | null>;
  /** Bereits abgerechnete Spieltage, aus denen die Auswertung besteht. */
  playedDays: number[];
  /**
   * Spieltage ohne verwertbare eigene Aufstellung — entweder stand an dem Tag
   * keine (Liga erst später betreten, Aufstellung vergessen), oder Kickbase
   * hat mit der Tabelle eines anderen Spieltags geantwortet. Ihre Punkte
   * fehlen in der Auswertung, und der Screen sagt das, statt eine zu kurze
   * Summe als vollständig auszugeben.
   */
  unresolvedDays: number[];
  /**
   * Die eigene User-ID, wie sie diese Auswertung benutzt — aus der Session
   * oder, wenn die sie nicht hat, EINMAL aus der Tabelle abgeleitet (siehe
   * unten). `null` = nicht bestimmbar, dann bleibt auch die Transferbilanz
   * leer.
   */
  ownUserId: string | null;
  /** Saisonpunkte laut Kickbase — Gegenprobe zur Summe der erfassten Punkte. */
  seasonPoints: number | null;
  /** Noch laufende Requests und ihre Gesamtzahl, für die Fortschrittszeile. */
  pending: number;
  total: number;
  /** Alle IDs, die je in der eigenen Elf standen oder heute im Kader stehen. */
  ownedPlayerIds: string[];
  /** playerId → heutiger Marktwert (nur eigene Kaderspieler). */
  marketValues: Map<string, number>;
  ownSquadIds: Set<string>;
  names: Map<string, string>;
  /** Das Nötigste für QueryState: solange `ready` false ist, gibt es nichts zu zeigen. */
  ready: boolean;
  refetchables: { refetch: () => Promise<unknown> }[];
  matchdaysQuery: ReturnType<typeof useMatchdays>;
  lineupQuery: ReturnType<typeof useLineup>;
}

export function useSeasonPointSources(leagueId: string): SeasonPointSources {
  const competitionId = useCompetitionId();
  const { userId } = useAuth();

  const matchdaysQuery = useMatchdays(competitionId);
  const lineupQuery = useLineup(leagueId);
  const teamsQuery = useCompetitionTeams(competitionId);

  /*
   * Nur KOMPLETT ausgetragene Spieltage. Der laufende bliebe sonst mit einer
   * halben Elf und halben Punkten in der Summe stehen und ließe die Rangfolge
   * im Minutentakt wackeln — und `allPlayed` ist dafür die genauere Schranke
   * als `currentDay`, das dem echten Stand hinterherhängt (siehe
   * toMatchdaySchedule).
   */
  const playedDays = useMemo(
    () =>
      (matchdaysQuery.data?.matchdays ?? [])
        .filter((matchday) => matchday.allPlayed)
        .map((matchday) => matchday.day)
        .sort((a, b) => a - b),
    [matchdaysQuery.data],
  );

  const rankings = useMatchdayRankings(leagueId, playedDays);

  const ownSquadIds = useMemo(
    () => new Set((lineupQuery.data?.players ?? []).map((player) => player.id)),
    [lineupQuery.data],
  );
  const ownPlayerIds = useMemo(() => [...ownSquadIds], [ownSquadIds]);

  /*
   * Die eigene User-ID wird GENAU EINMAL bestimmt und dann auf jeden Spieltag
   * angewandt.
   *
   * Steht sie in der Session, ist nichts zu tun. Fehlt sie (möglich, siehe
   * findOwnRankingEntry), bleibt der Umweg über den eigenen Kader — aber nur
   * am ZULETZT gespielten Spieltag: dort ist die Überschneidung zwischen
   * heutigem Kader und damaliger Elf am größten und der Schluss damit am
   * belastbarsten. Dieselbe Heuristik an Spieltag 1 anzuwenden hieße, sie 34
   * Mal getrennt raten zu lassen — mit der Aussicht, ausgerechnet dort den
   * Manager zu treffen, von dem man die halbe Elf gekauft hat.
   */
  const ownUserId = useMemo(() => {
    if (userId) return userId;
    const lastDay = playedDays[playedDays.length - 1];
    const ranking = lastDay === undefined ? undefined : rankings.rankings.get(lastDay);
    if (!ranking) return null;
    return findOwnRankingEntry(ranking.entries, null, ownPlayerIds)?.userId ?? null;
  }, [userId, playedDays, rankings.rankings, ownPlayerIds]);

  /*
   * Die eigene Elf je Spieltag. `ranking.day` ist die Gegenprobe zum
   * angefragten Spieltag (siehe LeagueRanking.day): antwortet Kickbase mit
   * einem anderen Tag, ist die gelieferte Elf nicht die gesuchte — dann lieber
   * kein Eintrag als elf Spieler am falschen Spieltag.
   */
  const { lineups, unresolvedDays } = useMemo(() => {
    const result: MatchdayLineup[] = [];
    const unresolved: number[] = [];

    for (const day of playedDays) {
      const ranking = rankings.rankings.get(day);
      // Noch nicht geladen ist nicht dasselbe wie nicht vorhanden — das meldet
      // die Fortschrittszeile, nicht der Hinweis auf fehlende Spieltage.
      if (!ranking) continue;
      if (ranking.day !== null && ranking.day !== day) {
        unresolved.push(day);
        continue;
      }
      const own = ranking.entries.find((entry) => entry.userId === ownUserId);
      const playerIds = (own?.lineupPlayerIds ?? []).filter((id): id is string => id !== null);
      if (playerIds.length === 0) {
        unresolved.push(day);
        continue;
      }
      result.push({ day, playerIds });
    }

    return { lineups: result, unresolvedDays: unresolved };
  }, [playedDays, rankings.rankings, ownUserId]);

  // Sortiert, damit die Query-Liste von useQueries zwischen zwei Rendern
  // dieselbe Reihenfolge hat.
  const fieldedIds = useMemo(
    () => [...new Set(lineups.flatMap((lineup) => lineup.playerIds))].sort(),
    [lineups],
  );
  // Alles, was im Kader steht, kennt die App schon aus `/squad` — nachgeladen
  // wird nur, was seitdem verkauft wurde.
  const unknownIds = useMemo(
    () => fieldedIds.filter((id) => !ownSquadIds.has(id)),
    [fieldedIds, ownSquadIds],
  );

  const points = useMatchdayPoints(leagueId, fieldedIds);
  const basics = usePlayerBasics(leagueId, unknownIds);

  const meta = useMemo(() => {
    const map = new Map<string, StatsPlayerMeta>();
    for (const player of lineupQuery.data?.players ?? []) {
      map.set(player.id, {
        name: player.name,
        teamId: player.teamId,
        position: player.position,
        imageUrl: player.imageUrl,
      });
    }
    for (const [playerId, detail] of basics.players) {
      map.set(playerId, {
        name: detail.name,
        teamId: detail.teamId,
        position: detail.position,
        imageUrl: detail.imageUrl,
      });
    }
    return map;
  }, [lineupQuery.data, basics.players]);

  const sources = useMemo(
    () => buildPointSources({ lineups, pointsByPlayer: points.pointsByPlayer, meta }),
    [lineups, points.pointsByPlayer, meta],
  );

  const teamNames = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name])),
    [teamsQuery.data],
  );
  const teamLogos = useMemo(
    () => new Map((teamsQuery.data ?? []).map((team) => [team.id, team.logoUrl])),
    [teamsQuery.data],
  );

  // Die Saisonpunkte stehen in JEDER Tabelle; genommen wird die des letzten
  // abgerechneten Spieltags, weil sie als Einzige alle Spieltage enthält.
  const seasonPoints = useMemo(() => {
    const lastDay = playedDays[playedDays.length - 1];
    const ranking = lastDay === undefined ? undefined : rankings.rankings.get(lastDay);
    if (!ranking) return null;
    return ranking.entries.find((entry) => entry.userId === ownUserId)?.seasonPoints ?? null;
  }, [playedDays, rankings.rankings, ownUserId]);

  const ownedPlayerIds = useMemo(
    () => [...new Set([...fieldedIds, ...ownSquadIds])].sort(),
    [fieldedIds, ownSquadIds],
  );

  const marketValues = useMemo(
    () => new Map((lineupQuery.data?.players ?? []).map((player) => [player.id, player.marketValue])),
    [lineupQuery.data],
  );

  const names = useMemo(
    () => new Map([...meta].map(([playerId, info]) => [playerId, info.name])),
    [meta],
  );

  return {
    sources,
    teamNames,
    teamLogos,
    playedDays,
    unresolvedDays,
    ownUserId,
    seasonPoints,
    pending: rankings.pending + points.pending + basics.pending,
    total: rankings.total + points.total + basics.total,
    ownedPlayerIds,
    marketValues,
    ownSquadIds,
    names,
    ready: !!matchdaysQuery.data && !!lineupQuery.data,
    refetchables: [matchdaysQuery, lineupQuery, teamsQuery, rankings, points, basics],
    matchdaysQuery,
    lineupQuery,
  };
}

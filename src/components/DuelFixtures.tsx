import { useMemo } from 'react';
import type { LeagueRankingEntry, PlayerDetail, ScheduledMatchday } from '@/api/kickbase';
import { useLeagueRanking, usePlayerBasics } from '@/queries/hooks';
import disclosure from '@/components/Disclosure.module.css';
import styles from './DuelFixtures.module.css';

interface Props {
  leagueId: string;
  day: ScheduledMatchday;
  ownId: string;
  opponentId: string;
  now: number;
}

export function DuelFixtures({ leagueId, day, ownId, opponentId, now }: Props) {
  const query = useLeagueRanking(leagueId, day.day, { live: true });
  const entries = query.data?.day === day.day ? query.data.entries : [];
  const own = entries.find((p) => p.userId === ownId);
  const opponent = entries.find((p) => p.userId === opponentId);
  const ids = useMemo(() => [...(own?.lineupPlayerIds ?? []), ...(opponent?.lineupPlayerIds ?? [])],
    [own, opponent]);
  const { players } = usePlayerBasics(leagueId, ids, { averages: false });
  if (!own || !opponent || (own.h2hOpponentUserId && own.h2hOpponentUserId !== opponentId)) {
    return <p className={disclosure.note}>Die Duell-Aufstellungen für Spieltag {day.day} sind noch nicht verfügbar.</p>;
  }
  return <section className={styles.sides} aria-label="Ausstehende Partien im Duell">
    <DuelSide label="Du" entry={own} day={day} now={now} players={players} />
    <DuelSide label={opponent.userName} entry={opponent} day={day} now={now} players={players} />
  </section>;
}

function DuelSide({ label, entry, day, now, players }: {
  label: string;
  entry: LeagueRankingEntry;
  day: ScheduledMatchday;
  now: number;
  players: ReadonlyMap<string, PlayerDetail>;
}) {
  const ids = entry.lineupPlayerIds.filter((id): id is string => !!id);
  if (!ids.length) return <p className={disclosure.note}>{label} · Startelf noch nicht sichtbar</p>;
  const upcoming: { id: string; name: string; kickoff: number }[] = [];
  let unknown = 0;
  for (const id of ids) {
    const player = players.get(id);
    const fixture = player && day.fixtures.find((f) => f.homeTeamId === player.teamId || f.awayTeamId === player.teamId);
    if (fixture?.hasResult) continue;
    const kickoff = Date.parse(fixture?.kickoffAt ?? '');
    if (!Number.isFinite(kickoff) || !player) unknown++;
    else if (kickoff > now) upcoming.push({ id, name: player.name, kickoff });
  }
  upcoming.sort((a, b) => a.kickoff - b.kickoff);
  return <details className={disclosure.disclosure}>
    <summary className={disclosure.summary}>{label} · {upcoming.length} vor Anstoß{unknown > 0 && ` · ${unknown} ungeklärt`}</summary>
    {upcoming.length > 0 && <ul className={disclosure.list}>{upcoming.map((p) => <li key={p.id} className={styles.fixture}>
      <span>{p.name}</span> <time className={styles.kickoff} dateTime={new Date(p.kickoff).toISOString()}>
        {new Date(p.kickoff).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
      </time>
    </li>)}</ul>}
    {unknown > 0 && <p className={styles.missing}>Für diese Spieler fehlen Spielerdaten oder Anstoßzeit.</p>}
  </details>;
}

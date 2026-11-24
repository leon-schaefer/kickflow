import { useMemo, useState, useSyncExternalStore } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getPlayerPerformance, type MatchdaySchedule, type SquadPlayer } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { useLeagueRanking } from '@/queries/hooks';
import { queryKeys } from '@/queries/keys';
import { reviewKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { formatIsoDate } from '@/utils/format';
import { resolveMatchdayState } from '@/utils/matchday';
import { RESULT_SETTLE_MS, settledMatchPoints } from '@/utils/pointAverages';
import type { LineupRule } from './rules';
import { legalReplacements, readArchive, type MatchdaySnapshot } from './matchdayReview';

function subscribe(update: () => void) {
  window.addEventListener('storage', update);
  window.addEventListener('matchday-archive-change', update);
  return () => {
    window.removeEventListener('storage', update);
    window.removeEventListener('matchday-archive-change', update);
  };
}

export function useMatchdayArchive(leagueId: string) {
  const { userId } = useAuth();
  const key = userId ? reviewKey(leagueId, userId) : null;
  const [notice, setNotice] = useState('');
  const raw = useSyncExternalStore(subscribe, () => key && localStore.getItemSync(key));
  const snapshots = useMemo(() => readArchive(raw), [raw]);

  function record(open: { day: number; deadline: string } | null, players: SquadPlayer[],
    formation: string, submitted: string[], rules: LineupRule[]) {
    if (!key || !open || !(Date.parse(open.deadline) > Date.now())) return;
    const snapshot: MatchdaySnapshot = {
      day: open.day, deadline: open.deadline, capturedAt: new Date().toISOString(), formation, submitted, rules,
      players: players.map(({ id, name, position, teamId }) => ({ id, name, position, teamId })),
    };
    const previous = readArchive(localStore.getItemSync(key)).filter((s) => s.deadline !== open.deadline);
    try {
      window.localStorage.setItem(key, JSON.stringify([snapshot, ...previous].slice(0, 34)));
      window.dispatchEvent(new Event('matchday-archive-change'));
      setNotice(`Kader für Spieltag ${open.day} gesichert · ${new Date().toLocaleTimeString('de-DE')}`);
    } catch {
      setNotice('Der Rückblick konnte auf diesem Gerät nicht gesichert werden.');
    }
  }
  return { userId, snapshots, record, notice };
}

interface Props {
  leagueId: string;
  archive: ReturnType<typeof useMatchdayArchive>;
  schedule?: MatchdaySchedule;
  onRecord: () => void;
  ready: boolean;
}

export function MatchdayReview({ leagueId, archive, schedule, onRecord, ready }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState('');
  const current = archive.snapshots.find((s) => s.deadline === selected) ?? archive.snapshots[0];
  const open = schedule && resolveMatchdayState(schedule, Date.now()).open;
  const scheduled = schedule?.matchdays.find((d) => d.day === current?.day && d.firstKickoff === current.deadline);
  const finished = scheduled?.allPlayed && scheduled.fixtures.length > 0 && scheduled.fixtures.every((f) =>
    f.kickoffAt && Date.parse(f.kickoffAt) + RESULT_SETTLE_MS <= Date.now());
  return <details onToggle={(e) => setExpanded(e.currentTarget.open)}>
    <summary>Spieltagsrückblick</summary>
    <p>Sichere Kader und Regeln vor Anstoß. Wenn du danach deine Elf in kickflow speicherst, aktualisiert sich der gesicherte Spieltag.</p>
    {open && archive.userId && <button type="button" disabled={!ready} onClick={onRecord}>Kader für Spieltag {open.day} sichern</button>}
    {archive.notice && <p role="status">{archive.notice}</p>}
    {!archive.userId ? <p>Für deinen persönlichen Rückblick bitte erneut anmelden.</p> :
      !current ? <p>Noch kein Spieltag auf diesem Gerät gesichert.</p> : <>
        <label>Gesicherter Spieltag <select value={current.deadline} onChange={(e) => setSelected(e.target.value)}>
          {archive.snapshots.map((s) => <option key={s.deadline} value={s.deadline}>Spieltag {s.day} · {formatIsoDate(s.deadline)}</option>)}
        </select></label>
        <p>Kaderstand vom {new Date(current.capturedAt).toLocaleString('de-DE')} · {current.formation}</p>
        {expanded && (finished && schedule
          ? <ReviewResult leagueId={leagueId} snapshot={current} userId={archive.userId} schedule={schedule} />
          : <p>{scheduled ? 'Die Auswertung erscheint nach Abschluss des Spieltags.' : 'Der passende Saisonspielplan ist derzeit nicht verfügbar.'}</p>)}
      </>}
  </details>;
}

function ReviewResult({ leagueId, snapshot, userId, schedule }: {
  leagueId: string; snapshot: MatchdaySnapshot; userId: string; schedule: MatchdaySchedule;
}) {
  const ranking = useLeagueRanking(leagueId, snapshot.day);
  const row = ranking.data?.day === snapshot.day ? ranking.data.entries.find((p) => p.userId === userId) : null;
  const official = row?.lineupPlayerIds.filter((id): id is string => !!id);
  if (!official?.length) return <p>{ranking.isPending ? 'Startelf wird geladen …' : 'Kickbase hat die abgegebene Elf für diesen Spieltag nicht bestätigt.'}</p>;
  if (official.some((id) => !snapshot.players.some((p) => p.id === id))) {
    return <p>Die abgegebene Startelf enthält Spieler außerhalb des gesicherten Kaders. Für diesen Spieltag ist kein vollständiger Vergleich möglich.</p>;
  }
  return <BenchReview leagueId={leagueId} snapshot={snapshot} official={official} schedule={schedule} />;
}

function BenchReview({ leagueId, snapshot, official, schedule }: {
  leagueId: string; snapshot: MatchdaySnapshot; official: string[]; schedule: MatchdaySchedule;
}) {
  const { token } = useAuth();
  const results = useQueries({ queries: snapshot.players.map((p) => ({
    queryKey: queryKeys.playerPerformance(leagueId, p.id),
    queryFn: () => getPlayerPerformance(token!, leagueId, p.id),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })) });
  const points = new Map(snapshot.players.map((p, i) => {
    const history = results[i].data;
    const match = history && settledMatchPoints(history, schedule, Date.now())?.find((md) => md.matchday === snapshot.day);
    return [p.id, match?.points] as const;
  }));
  const starters = snapshot.players.filter((p) => official.includes(p.id));
  const bench = snapshot.players.filter((p) => !official.includes(p.id));
  return <section aria-label="Bank und mögliche Wechsel">
    {snapshot.submitted.length !== official.length || official.some((id) => !snapshot.submitted.includes(id))
      ? <p>Die endgültige Kickbase-Elf weicht vom gesicherten Stand ab. Hier gilt die endgültige Besetzung.</p> : null}
    {results.some((q) => q.isPending) && <p role="status">Spieltagspunkte werden geladen …</p>}
    {results.some((q) => q.isError) && <button type="button" onClick={() => results.filter((q) => q.isError).forEach((q) => void q.refetch())}>Fehlende Punkte erneut laden</button>}
    <details>
      <summary>Abgegebene Startelf ({starters.length})</summary>
      <ul>{starters.map((p) => <li key={p.id}>{p.name} · {points.get(p.id) ?? '—'} Punkte</li>)}</ul>
    </details>
    {!bench.length && <p>Alle Spieler des gesicherten Kaders standen in der Startelf.</p>}
    {bench.map((p) => {
      const score = points.get(p.id);
      const swaps = legalReplacements(snapshot, starters, p).map((swap) => {
        const outgoing = points.get(swap.player.id);
        return { ...swap, delta: outgoing == null || score == null ? null : score - outgoing };
      }).sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
      return <details key={p.id}>
        <summary>{p.name} · {score == null ? 'Punkte unbekannt' : `${score} Punkte`}</summary>
        {swaps.length ? <ul>{swaps.map(({ player, formation, delta }) =>
          <li key={player.id}>Für {player.name} · {formation} · {delta == null ? 'Differenz unbekannt' : `${delta > 0 ? '+' : ''}${delta} Punkte`}</li>)}</ul>
          : <p>Kein regelkonformer Einzelwechsel möglich.</p>}
      </details>;
    })}
  </section>;
}

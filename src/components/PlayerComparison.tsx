import { useState } from 'react';
import type { MarketPlayer, MatchdaySchedule, PlayerDetail, SquadPlayer } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { usePlayer } from '@/queries/hooks';
import { formatCurrency } from '@/utils/format';
import { RESULT_SETTLE_MS, settledMatchPoints } from '@/utils/pointAverages';
import { Modal } from './Modal';
import styles from './PlayerComparison.module.css';

interface Props {
  first: PlayerDetail;
  squad: SquadPlayer[];
  market: MarketPlayer[];
  schedule?: MatchdaySchedule;
  teamNames: ReadonlyMap<string, string>;
}

export function PlayerComparison(props: Props) {
  const [open, setOpen] = useState(false);
  const [secondId, setSecondId] = useState('');
  const players = new Map([...props.squad, ...props.market].map((p) => [p.id, p]));
  players.delete(props.first.id);
  return <>
    <button type="button" className={styles.action} onClick={() => setOpen(true)}>Spieler vergleichen</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Spielervergleich" panelClassName={styles.panel}>
      <label>Vergleichen mit <select value={players.has(secondId) ? secondId : ''} onChange={(e) => setSecondId(e.target.value)}>
        <option value="">Aus Kader oder Markt wählen</option>
        {[...players.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((p) =>
          <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      {players.has(secondId) && <CompareSelection {...props} secondId={secondId} />}
      <button type="button" onClick={() => setOpen(false)}>Schließen</button>
    </Modal>
  </>;
}

function CompareSelection({ secondId, first, schedule, teamNames, market }: Props & { secondId: string }) {
  const other = usePlayer(useLeagueId(), secondId);
  if (!other.data) return other.error
    ? <button type="button" onClick={() => other.refetch()}>Spielerdaten erneut laden</button>
    : <p role="status">Spielerdaten werden geladen …</p>;
  const now = Date.now();
  const days = (schedule?.matchdays ?? []).filter((d) => d.allPlayed && d.fixtures.length > 0 &&
    d.fixtures.every((f) => f.kickoffAt && Date.parse(f.kickoffAt) + RESULT_SETTLE_MS <= now))
    .sort((a, b) => b.day - a.day).slice(0, 5);
  const columns = [first, other.data].map((player) => {
    const history = settledMatchPoints(player.performance, schedule, now);
    const upcoming = (schedule?.matchdays ?? []).flatMap((day) => day.fixtures)
      .filter((f) => f.kickoffAt && Date.parse(f.kickoffAt) > now &&
        (f.homeTeamId === player.teamId || f.awayTeamId === player.teamId))
      .sort((a, b) => Date.parse(a.kickoffAt!) - Date.parse(b.kickoffAt!)).slice(0, 3)
      .map((f) => {
        const home = f.homeTeamId === player.teamId;
        const id = home ? f.awayTeamId : f.homeTeamId;
        return `${teamNames.get(id) ?? `Team ${id}`} (${home ? 'H' : 'A'})`;
      });
    return { player, history, upcoming, price: market.find((p) => p.id === player.id)?.price };
  });
  return <table className={styles.table}>
    <caption>Die letzten {days.length} abgeschlossenen Spieltage</caption>
    <thead><tr><th scope="col">Kennzahl</th>{columns.map(({ player }) =>
      <th key={player.id} scope="col">{player.name}</th>)}</tr></thead>
    <tbody>
      {days.map((day) => <tr key={day.day}><th scope="row">Spieltag {day.day}</th>
        {columns.map(({ player, history }) => {
          const match = history?.find((m) => m.matchday === day.day);
          return <td key={player.id}>{!match ? 'Keine Daten' : match.minutesPlayed === 0 && match.points === 0
            ? 'Ohne Einsatz' : `${match.points} Pkt. · ${match.minutesPlayed} Min.`}</td>;
        })}</tr>)}
      <tr><th scope="row">Marktwert</th>{columns.map(({ player }) => <td key={player.id}>{formatCurrency(player.marketValue)}</td>)}</tr>
      <tr><th scope="row">Angebotspreis</th>{columns.map(({ player, price }) => <td key={player.id}>{price == null ? 'Kein Angebot' : formatCurrency(price)}</td>)}</tr>
      <tr><th scope="row">Nächste Gegner</th>{columns.map(({ player, upcoming }) => <td key={player.id}>{upcoming.join(', ') || 'Keine Termine'}</td>)}</tr>
    </tbody>
  </table>;
}

import { useMemo, useState } from 'react';
import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import type { LineupConstraints } from '@/lineup/rules';
import { optimizeLineupWithRules } from '@/utils/constrainedLineup';
import { withExpectedPoints, type AverageDifficulty } from '@/utils/fixtureDifficulty';
import { formatCurrency, formatPoints } from '@/utils/format';
import { Checkbox } from './Checkbox';
import { Modal } from './Modal';
import { TextField } from './TextField';
import styles from './TransferPlanner.module.css';

interface Props {
  squad: readonly SquadPlayer[];
  market: readonly MarketPlayer[];
  balance: number;
  constraints: LineupConstraints;
  difficulty?: ReadonlyMap<string, AverageDifficulty>;
  onClose: () => void;
}

function validPrice(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function TransferPlanner({ squad, market, balance, constraints, difficulty, onClose }: Props) {
  const [targetId, setTargetId] = useState('');
  const [bid, setBid] = useState('');
  const [sales, setSales] = useState<Record<string, string>>({});
  const candidates = market.filter((p) => !squad.some((own) => own.id === p.id));
  const target = candidates.find((p) => p.id === targetId);
  const sold = squad.filter((p) => Object.hasOwn(sales, p.id));
  const pricesValid = validPrice(bid) && sold.every((p) => validPrice(sales[p.id]));
  const remainingMoney = balance - Number(bid) + sold.reduce((sum, p) => sum + Number(sales[p.id]), 0);
  const before = useMemo(() => optimizeLineupWithRules(withExpectedPoints(squad, difficulty),
    'expectedPoints', undefined, constraints).best, [squad, difficulty, constraints]);
  const after = useMemo(() => {
    if (!target) return null;
    const next = [...squad.filter((p) => !Object.hasOwn(sales, p.id)), target];
    return optimizeLineupWithRules(withExpectedPoints(next, difficulty), 'expectedPoints', undefined, constraints).best;
  }, [squad, sales, target, difficulty, constraints]);

  return (
    <Modal open onClose={onClose} title="Transferpaket durchspielen" panelClassName={styles.panel}>
      <label>Geplanter Zugang
        <select value={target?.id ?? ''} onChange={(event) => {
          const player = candidates.find((p) => p.id === event.target.value);
          setTargetId(player?.id ?? '');
          setBid(player ? String(player.ownOfferPrice ?? player.price) : '');
        }}>
          <option value="">Marktspieler wählen</option>
          {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {target && <>
        <TextField aria-label="Geplantes Gebot in Euro" inputMode="numeric" value={bid} onChange={setBid} suffix="€" />
        <fieldset><legend>Geplante Verkäufe</legend>
          {squad.map((p) => <div key={p.id}>
            <Checkbox label={p.name} checked={Object.hasOwn(sales, p.id)} onChange={(checked) => {
              const next = { ...sales };
              if (checked) next[p.id] = String(p.marketValue);
              else delete next[p.id];
              setSales(next);
            }} />
            {Object.hasOwn(sales, p.id) && <TextField aria-label={`Erlös für ${p.name} in Euro`}
              inputMode="numeric" suffix="€" value={sales[p.id]} onChange={(price) => setSales({ ...sales, [p.id]: price })} />}
          </div>)}
        </fieldset>
        <section aria-live="polite">
          <h3>Nach den Transfers</h3>
          <p>{pricesValid ? `Kontostand ${formatCurrency(remainingMoney)}` : 'Bitte positive Beträge in ganzen Euro eingeben.'}</p>
          {after ? <>
            <p>Formation {after.formation} · {formatPoints(after.score ?? 0)} erwartete Punkte</p>
            {before?.score != null && after.score != null && <p>Differenz zur heutigen besten Elf: {formatPoints(after.score - before.score)} Punkte</p>}
            {!before && <p>Der bisherige Kader kann keine vollständige Elf stellen.</p>}
            <ul>{after.playerIds.map((id) => <li key={id}>{id === target.id ? target.name : squad.find((p) => p.id === id)?.name}
              {after.fillerIds.includes(id) && ' · Ausfall'}</li>)}</ul>
            {target.averagePointsKnown === false && <p>Für den Zugang fehlt ein Punkteschnitt. Er geht mit 0 Punkten in die Schätzung ein.</p>}
          </> : <p>Mit diesem Kader ist keine vollständige regelkonforme Elf möglich.</p>}
        </section>
      </>}
      <button type="button" onClick={onClose}>Schließen</button>
    </Modal>
  );
}

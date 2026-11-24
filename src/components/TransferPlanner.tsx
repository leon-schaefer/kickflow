import { useMemo, useState } from 'react';
import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import type { LineupConstraints } from '@/lineup/rules';
import { positionLabels } from '@/theme/tokens';
import { optimizeLineupWithRules } from '@/utils/constrainedLineup';
import { withExpectedPoints, type AverageDifficulty } from '@/utils/fixtureDifficulty';
import { formatCurrency, formatPoints } from '@/utils/format';
import { Checkbox } from './Checkbox';
import { Modal } from './Modal';
import { TextField } from './TextField';
import disclosure from './Disclosure.module.css';
import controls from './FormControls.module.css';
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

  const difference = before?.score != null && after?.score != null ? after.score - before.score : null;

  return (
    <Modal open onClose={onClose} title="Transferpaket planen" panelClassName={styles.panel}>
      <div className={styles.body}>
        <p className={disclosure.note}>Nur eine Simulation: Es werden keine Gebote abgegeben und keine Spieler verkauft.</p>
        {candidates.length === 0 ? (
          <p className={styles.card}>Aktuell gibt es keinen Marktspieler, den du für deinen Kader einplanen kannst.</p>
        ) : (
          <section className={styles.card}>
            <h3 className={styles.heading}><label htmlFor="transfer-target">Geplanter Zugang</label></h3>
            <select id="transfer-target" className={controls.select} value={target?.id ?? ''} onChange={(event) => {
              const player = candidates.find((candidate) => candidate.id === event.target.value);
              setTargetId(player?.id ?? '');
              setBid(player ? String(player.ownOfferPrice ?? player.price) : '');
            }}>
              <option value="">Marktspieler wählen</option>
              {candidates.map((player) => <option key={player.id} value={player.id}>{player.name} · {positionLabels[player.position]}</option>)}
            </select>
            {target && <>
              <label className={controls.label} htmlFor="transfer-bid">Geplantes Gebot</label>
              <TextField id="transfer-bid" inputMode="numeric" value={bid} onChange={setBid} suffix="€" aria-invalid={!validPrice(bid)} />
            </>}
          </section>
        )}
        {target && <>
          {squad.length > 0 && <details className={disclosure.disclosure}>
            <summary className={disclosure.summary}>Geplante Verkäufe <span className={styles.badge}>{sold.length || 'Optional'}</span></summary>
            {squad.map((player) => {
              const selected = Object.hasOwn(sales, player.id);
              return (
                <div className={styles.sale} key={player.id}>
                  <Checkbox label={player.name} hint={`${positionLabels[player.position]} · Marktwert ${formatCurrency(player.marketValue)}`}
                    checked={selected} onChange={(checked) => {
                      const next = { ...sales };
                      if (checked) next[player.id] = String(player.marketValue);
                      else delete next[player.id];
                      setSales(next);
                    }} />
                  {selected && <>
                    <label className={controls.label} htmlFor={`proceeds-${player.id}`}>Geplanter Erlös</label>
                    <TextField id={`proceeds-${player.id}`} aria-label={`Erlös für ${player.name} in Euro`}
                      aria-invalid={!validPrice(sales[player.id])} inputMode="numeric" suffix="€" value={sales[player.id]}
                      onChange={(price) => setSales({ ...sales, [player.id]: price })} />
                  </>}
                </div>
              );
            })}
          </details>}
          <section className={styles.result}>
            <h3 className={styles.heading}>Nach den Transfers</h3>
            <div className={styles.metrics} aria-live="polite">
              <div className={styles.metric}>
                <span className={controls.label}>Kontostand</span>
                <strong className={styles.value} data-negative={pricesValid && remainingMoney < 0}>
                  {pricesValid ? `${remainingMoney.toLocaleString('de-DE')} €` : '—'}
                </strong>
              </div>
              {after && <div className={styles.metric}>
                <span className={controls.label}>Erwartete Punkte</span>
                <strong className={styles.value}>{formatPoints(after.score ?? 0)}</strong>
              </div>}
            </div>
            {!pricesValid && <p className={styles.warning} role="status">Bitte positive Beträge in ganzen Euro eingeben.</p>}
            {after ? <>
              {difference !== null && <p className={disclosure.note}>{difference > 0 ? '+' : ''}{formatPoints(difference)} Punkte gegenüber deiner bisherigen besten Elf.</p>}
              {!before && <p className={disclosure.note}>Der bisherige Kader kann keine vollständige Elf stellen.</p>}
              <details className={disclosure.disclosure}>
                <summary className={disclosure.summary}>Beste Elf <span className={styles.badge}>{after.formation}</span></summary>
                <ul className={disclosure.list}>{after.playerIds.map((id) => {
                  const player = id === target.id ? target : squad.find((member) => member.id === id);
                  return player && <li key={id} className={styles.lineupRow}>
                    <span className={styles.position}>{positionLabels[player.position]}</span>
                    {player.name}{after.fillerIds.includes(id) && ' · Ausfall'}
                  </li>;
                })}</ul>
              </details>
              {target.averagePointsKnown === false && <p className={disclosure.note}>Für den Zugang fehlt ein Punkteschnitt. Er geht mit 0 Punkten in die Schätzung ein.</p>}
            </> : <p className={disclosure.note}>Mit diesem Kader ist keine vollständige regelkonforme Elf möglich.</p>}
          </section>
        </>}
      </div>
      <button type="button" className={controls.button} onClick={onClose}>Schließen</button>
    </Modal>
  );
}

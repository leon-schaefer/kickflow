import { useState } from 'react';
import '@/app/zodConfig';
import { z } from 'zod';
import type { Position, SquadPlayer } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { TextField } from '@/components/TextField';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { variantsKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { AVAILABLE_FORMATIONS, requiredCountsForFormation } from '@/utils/formations';

const variant = z.object({
  name: z.string().trim().min(1).max(60),
  formation: z.string().refine((f) => AVAILABLE_FORMATIONS.includes(f)),
  ids: z.array(z.string()).max(11),
});
type Variant = z.infer<typeof variant>;
const slotsSchema = z.tuple([variant.nullable(), variant.nullable()]);
type Slots = z.infer<typeof slotsSchema>;

function readSlots(key: string): Slots {
  try {
    return slotsSchema.parse(JSON.parse(localStore.getItemSync(key) ?? 'null'));
  } catch {
    return [null, null];
  }
}

interface Props {
  formation: string;
  draftIds: string[];
  players: ReadonlyMap<string, SquadPlayer>;
  onLoad: (formation: string, ids: string[], note: string) => void;
}

export function LineupVariants(props: Props) {
  const { userId } = useAuth();
  const leagueId = useLeagueId();
  if (!userId) return <p>Für gespeicherte Varianten bitte erneut anmelden.</p>;
  const storageKey = variantsKey(leagueId, userId);
  return <VariantEditor key={storageKey} storageKey={storageKey} {...props} />;
}

function VariantEditor({ storageKey, formation, draftIds, players, onLoad }: Props & { storageKey: string }) {
  const [slots, setSlots] = useState(() => readSlots(storageKey));
  const [names, setNames] = useState(slots.map((slot, i) => slot?.name ?? (i === 0 ? 'Plan A' : 'Plan B')));
  const [message, setMessage] = useState('');

  function save(index: number) {
    const next = readSlots(storageKey);
    next[index] = { formation, ids: [...draftIds], name: names[index].trim() };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSlots(next);
      setMessage(`${next[index].name} auf diesem Gerät gespeichert.`);
    } catch {
      setMessage('Speichern auf diesem Gerät fehlgeschlagen.');
    }
  }

  function load(saved: Variant) {
    const remaining = requiredCountsForFormation(saved.formation);
    const ids: string[] = [];
    for (const id of saved.ids) {
      const position: Position | undefined = players.get(id)?.position;
      if (!position || !remaining[position] || ids.includes(id)) continue;
      remaining[position]--;
      ids.push(id);
    }
    const omitted = saved.ids.length - ids.length;
    const note = omitted ? ` · ${omitted} Plätze wegen Kaderänderungen offen` : '';
    onLoad(saved.formation, ids, `${saved.name} als Entwurf geladen${note}.`);
    setMessage('');
  }

  return <details>
    <summary>Meine Aufstellungsvarianten</summary>
    {slots.map((saved, index) => <fieldset key={index}>
      <legend>Variante {index + 1}</legend>
      <TextField aria-label={`Name der Variante ${index + 1}`} maxLength={60} value={names[index]}
        onChange={(name) => setNames(names.map((old, i) => i === index ? name : old))} />
      <button type="button" disabled={!names[index].trim() || !draftIds.length} onClick={() => save(index)}>
        {saved ? 'Mit Entwurf überschreiben' : 'Entwurf hier sichern'}
      </button>
      {saved && <button type="button" onClick={() => load(saved)}>{saved.name} laden · {saved.formation}</button>}
    </fieldset>)}
    {message && <p role="status">{message}</p>}
  </details>;
}

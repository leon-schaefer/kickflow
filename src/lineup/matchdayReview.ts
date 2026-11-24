import '@/app/zodConfig';
import { z } from 'zod';
import type { Position } from '@/api/kickbase';
import { lineupRulesSchema, violatedRules } from './rules';
import { formationFor } from '@/utils/formations';

const playerSchema = z.object({
  id: z.string(), name: z.string(), teamId: z.string(), position: z.enum(['GK', 'DEF', 'MID', 'FWD']),
});
const snapshotSchema = z.object({
  day: z.number().int().positive(), deadline: z.string(), capturedAt: z.string(), formation: z.string(),
  submitted: z.array(z.string()), players: z.array(playerSchema), rules: lineupRulesSchema,
});
export type MatchdaySnapshot = z.infer<typeof snapshotSchema>;
export type ArchivedPlayer = z.infer<typeof playerSchema>;

export function readArchive(raw: string | null): MatchdaySnapshot[] {
  try {
    return z.array(snapshotSchema).parse(JSON.parse(raw ?? '[]'));
  } catch {
    return [];
  }
}

export function legalReplacements(snapshot: MatchdaySnapshot, starters: ArchivedPlayer[], incoming: ArchivedPlayer) {
  return starters.flatMap((outgoing) => {
    const next = starters.map((p) => p.id === outgoing.id ? incoming : p);
    const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of next) counts[p.position]++;
    const formation = formationFor(counts, { current: snapshot.formation });
    if (!formation || violatedRules(snapshot.rules, next, next.map((p) => p.id)).length) return [];
    return [{ player: outgoing, formation }];
  });
}

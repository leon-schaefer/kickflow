import type { Position } from '@/api/kickbase';
import { parseFormation } from '@/api/kickbase';

/**
 * Bei Kickbase übliche Formationen. Jede besteht aus genau drei Zahlen
 * (ABW-MF-ANG) — der Torwart ist immer genau einer und taucht im String
 * nicht auf. Nicht durch scripts/probe.ts verifiziert, welche Formationen
 * der jeweilige Liga-Modus tatsächlich zulässt.
 */
export const AVAILABLE_FORMATIONS = [
  '3-4-3',
  '3-5-2',
  '4-4-2',
  '4-3-3',
  '4-2-4',
  '4-5-1',
  '5-3-2',
  '5-4-1',
];

/** Formation → geforderte Spieleranzahl je Position (GK ist immer 1). */
export function requiredCountsForFormation(formation: string): Record<Position, number> {
  const rows = parseFormation(formation);
  if (rows.length !== 3) {
    // Unbekanntes/unerwartetes Format — keine Annahme treffen, die den
    // Draft-State kaputt remappen könnte.
    return { GK: 1, DEF: 0, MID: 0, FWD: 0 };
  }
  const [def, mid, fwd] = rows;
  return { GK: 1, DEF: def!, MID: mid!, FWD: fwd! };
}

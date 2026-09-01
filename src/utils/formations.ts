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

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Sortiert IDs nach Position (GK, DEF, MID, FWD) — Kickbase leitet die
 * Positionszuordnung beim Speichern (mindestens teilweise) aus der
 * Reihenfolge des `players`-Arrays ab. Der Optimizer liefert `playerIds`
 * bereits in dieser Reihenfolge; manuelle Tausch-Interaktionen (Tap auf
 * Feld-/Bankspieler) hängen neue IDs dagegen einfach an, weshalb jeder
 * Speicher-Aufruf unabhängig vom Zustandekommen der Liste hier nochmal
 * normalisiert werden muss.
 */
export function orderIdsByPosition(
  ids: readonly string[],
  positionOf: (id: string) => Position | undefined,
): string[] {
  const byPosition: Record<Position, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const id of ids) {
    const position = positionOf(id);
    if (position) byPosition[position].push(id);
  }
  return POSITION_ORDER.flatMap((position) => byPosition[position]);
}

/**
 * Formation, in der die gegebene Positionsverteilung vollständig unterkommt
 * (count <= required je Position) — die Formation folgt damit der Aufstellung
 * statt umgekehrt (siehe tapBenchPlayer/tapPitchPlayer in lineup.tsx).
 * `current` gewinnt, wenn sie passt: umgestellt wird nie ohne Not. Sonst die
 * passende Formation mit dem höchsten `score`, bei Gleichstand (oder ganz ohne
 * `score`) die erste aus `formations`. null, wenn keine Formation passt.
 *
 * Eine Prüfung auf höchstens 11 Spieler erübrigt sich: jede Formation summiert
 * auf genau 11 (siehe formations.test.ts), also folgt das schon aus der
 * Positions-Bedingung. Ein zweiter Torwart passt entsprechend nirgends.
 */
export function formationFor(
  counts: Record<Position, number>,
  options: {
    current?: string;
    /** null = unbekannt/nicht bewertbar, verliert gegen jede Zahl. */
    score?: (formation: string) => number | null;
    formations?: readonly string[];
  } = {},
): string | null {
  const { current, score, formations = AVAILABLE_FORMATIONS } = options;
  const fits = (formation: string) => {
    const required = requiredCountsForFormation(formation);
    return POSITION_ORDER.every((position) => counts[position] <= required[position]);
  };

  if (current && formations.includes(current) && fits(current)) return current;

  let best: string | null = null;
  let bestScore = -Infinity;
  for (const formation of formations) {
    if (!fits(formation)) continue;
    const value = score?.(formation) ?? -Infinity;
    if (best === null || value > bestScore) {
      best = formation;
      bestScore = value;
    }
  }
  return best;
}

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

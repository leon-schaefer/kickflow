import type { Position } from '@/api/kickbase';
import { parseFormation } from '@/api/kickbase';

/**
 * Die zehn Formationen, die Kickbase zur Wahl stellt — vollständig, nicht nur
 * die üblichen. Jede besteht aus genau drei Zahlen (ABW-MF-ANG); der Torwart
 * ist immer genau einer und taucht im String nicht auf.
 *
 * Kickbase nennt als Untergrenze 1 TW, 3 ABW, 2 MF, 1 ANG. Mit den vier frei
 * verteilbaren Restplätzen wären zwölf Kombinationen denkbar; 3-2-5 (fünf
 * Stürmer) und 3-3-4 bietet die App aber nicht an, die Liste ist also eine
 * feste Auswahl und nicht aus der Regel ableitbar — deshalb steht sie hier
 * ausgeschrieben und wird nicht berechnet.
 *
 * Quelle ist die Kickbase-Hilfe bzw. die App selbst, nicht scripts/probe.ts:
 * `POST /v4/leagues/{id}/lineup` nimmt den Formationsstring als freies `type`
 * entgegen (siehe endpoints.ts), die API gibt die erlaubte Menge also nicht her.
 * Ob ein einzelner Liga-Modus die Auswahl weiter einschränkt, ist unverifiziert.
 *
 * Gruppiert nach Abwehrreihe; die Reihenfolge innerhalb einer Gruppe ist
 * gewachsen und folgt keiner Regel. Kosmetisch ist sie trotzdem nicht: bei
 * punktgleichen Formationen gewinnt die frühere (siehe formationFor() und
 * optimizeLineup()), Umsortieren ändert also Ergebnisse.
 */
export const AVAILABLE_FORMATIONS = [
  '3-4-3',
  '3-5-2',
  '3-6-1',
  '4-4-2',
  '4-3-3',
  '4-2-4',
  '4-5-1',
  '5-2-3',
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

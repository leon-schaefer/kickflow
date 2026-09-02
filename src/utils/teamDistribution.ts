/**
 * Verteilungs-Zähler für Kader/Elf-Ansichten — Vereins- und Positionsverteilung.
 * Ursprünglich nur in rules.tsx ("Dein Kader"), jetzt auch für die Rivalen-Elf
 * im Liga-Tab (manager/[managerId].tsx) gebraucht, deshalb hierher gehoben.
 * Bewusst ohne Theme-Import (keine Klartext-Labels) — reine Zähl-Logik, die
 * Anzeige-Beschriftung bleibt Sache der aufrufenden Screens.
 */
import type { Position } from '@/api/kickbase';

export interface TeamCount {
  teamId: string;
  name: string;
  count: number;
}

export interface PositionCount {
  position: Position;
  count: number;
}

/** Vereinsverteilung, absteigend nach Anzahl — `teamNames` fehlt ein Verein, fällt der Name auf die ID zurück. */
export function countByTeam<T extends { teamId: string }>(
  players: readonly T[],
  teamNames: ReadonlyMap<string, string>,
): TeamCount[] {
  const counts = new Map<string, number>();
  for (const player of players) counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([teamId, count]) => ({ teamId, name: teamNames.get(teamId) ?? teamId, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

/** Positionsverteilung in fester Reihenfolge GK→DEF→MID→FWD, Positionen ohne Spieler ausgelassen. */
export function countByPosition<T extends { position: Position }>(players: readonly T[]): PositionCount[] {
  const counts = new Map<Position, number>();
  for (const player of players) counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  return POSITION_ORDER.filter((position) => counts.has(position)).map((position) => ({
    position,
    count: counts.get(position)!,
  }));
}

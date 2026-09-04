/**
 * Reiner Filter für Kader- und Marktlisten — hält Suche und Chip-Filter aus
 * den Screens heraus, damit beides isoliert testbar bleibt (siehe marketList.ts
 * für das Sortier-Gegenstück auf demselben Bildschirm).
 */
import type { PlayerStatus, Position } from '@/api/kickbase';

export interface PlayerFilterCriteria {
  /** Freitext über den Namen, groß-/kleinschreibungs- und akzentunabhängig. */
  query: string;
  /** Leer = keine Einschränkung (nicht "keine Treffer") — gilt für alle drei Felder unten. */
  positions: readonly Position[];
  statuses: readonly PlayerStatus[];
  teamIds: readonly string[];
}

export const EMPTY_PLAYER_FILTER: PlayerFilterCriteria = {
  query: '',
  positions: [],
  statuses: [],
  teamIds: [],
};

export function isPlayerFilterActive(criteria: PlayerFilterCriteria): boolean {
  return (
    criteria.query.trim().length > 0 ||
    criteria.positions.length > 0 ||
    criteria.statuses.length > 0 ||
    criteria.teamIds.length > 0
  );
}

/** Entfernt Akzente ("Müller" → "muller"), damit die Suche ohne Umlaut-Tastatur trifft. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

interface FilterablePlayer {
  name: string;
  position: Position;
  status: PlayerStatus;
  teamId: string;
}

export function filterPlayers<T extends FilterablePlayer>(
  players: readonly T[],
  criteria: PlayerFilterCriteria,
): T[] {
  const query = normalize(criteria.query);
  return players.filter((player) => {
    if (query && !normalize(player.name).includes(query)) return false;
    if (criteria.positions.length > 0 && !criteria.positions.includes(player.position)) return false;
    if (criteria.statuses.length > 0 && !criteria.statuses.includes(player.status)) return false;
    if (criteria.teamIds.length > 0 && !criteria.teamIds.includes(player.teamId)) return false;
    return true;
  });
}

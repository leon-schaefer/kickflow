import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MarketPlayer, Position, SquadPlayer } from '@/api/kickbase';
import { marketPlayer } from '@/test/marketPlayer';
import { squadPlayer } from '@/test/squadPlayer';
import type { AverageDifficulty } from '@/utils/fixtureDifficulty';
import { useReplacementAdvice } from './useReplacementAdvice';

/**
 * Der Hook selbst rechnet nichts — geprüft wird deshalb genau das, was er
 * beiträgt: dass BEIDE Seiten mit derselben Restprogramm-Gewichtung
 * angereichert werden, und dass Metrik und Schranken von außen kommen.
 *
 * Die Gewichtung ist der Fall, in dem eine halbe Umsetzung lautlos falsche
 * Zahlen liefert: würde nur der Markt angereichert, wäre jeder Zugewinn gegen
 * eine ungewichtete Elf gemessen. Die beiden Tests unten trennen die Seiten —
 * einer wird nur richtig, wenn der Kader gewichtet ist, der andere nur, wenn
 * der Markt es ist.
 */

/** Reichlich Spieler je Position, damit jede Formation aus AVAILABLE_FORMATIONS auch OHNE Zukauf besetzbar ist. */
function squad(teamId: string, averagePoints = 50): SquadPlayer[] {
  const counts: Record<Position, number> = { GK: 2, DEF: 6, MID: 7, FWD: 4 };
  const players: SquadPlayer[] = [];
  (Object.keys(counts) as Position[]).forEach((position) => {
    for (let i = 0; i < counts[position]; i++) {
      players.push(
        squadPlayer({ id: `${position}${i}`, position, teamId, averagePoints, valueScoreAvg: 5 }),
      );
    }
  });
  return players;
}

/** Gleiche Härte für Angriff und Abwehr — die Positionsunterscheidung ist hier nicht der Punkt. */
function difficulty(entries: Record<string, number>): Map<string, AverageDifficulty> {
  return new Map(
    Object.entries(entries).map(([teamId, value]) => [teamId, { attack: value, defense: value }]),
  );
}

function advise(
  players: SquadPlayer[],
  market: MarketPlayer[],
  byTeam?: Map<string, AverageDifficulty>,
) {
  const { result } = renderHook(() =>
    useReplacementAdvice(players, market, 'expectedPoints', undefined, null, byTeam),
  );
  return result.current;
}

describe('useReplacementAdvice', () => {
  it('gewichtet den eigenen Kader mit — ein leichtes Restprogramm macht den Zukauf überflüssig', () => {
    // Kader auf 50 Ø-Punkten, Kandidat auf 55. Ohne Gewichtung ist er besser.
    const players = squad('S');
    const market = [marketPlayer({ teamId: 'X', averagePoints: 55, marketValue: 5_000_000 })];

    expect(advise(players, market).options).toHaveLength(1);

    // Mit leichtem Restprogramm für den eigenen Verein (Härte 0 → Faktor 1,2)
    // erwartet die Elf 60 Punkte — der Kandidat (ohne Eintrag, also
    // ungewichtet 55) verbessert sie nicht mehr.
    expect(advise(players, market, difficulty({ S: 0 })).options).toHaveLength(0);
  });

  it('gewichtet die Marktkandidaten mit — ein leichtes Restprogramm macht den Zukauf erst lohnend', () => {
    // Kandidat mit 45 Ø-Punkten gegen einen Kader auf 50: roh chancenlos.
    const players = squad('S');
    const market = [marketPlayer({ teamId: 'X', averagePoints: 45, marketValue: 5_000_000 })];

    expect(advise(players, market).options).toHaveLength(0);

    // Mit leichtem Restprogramm für SEINEN Verein erwartet er 54 Punkte.
    expect(advise(players, market, difficulty({ X: 0 })).options).toHaveLength(1);
  });

  it('rechnet unter den übergebenen Schranken, nicht unter eigenen', () => {
    // Kader und Kandidat beim selben Verein: unter „max. 2 pro Verein" käme er
    // nicht in die Elf und ist damit keine Empfehlung.
    const players = squad('T');
    const market = [marketPlayer({ teamId: 'T', averagePoints: 200, marketValue: 5_000_000 })];

    const { result: open } = renderHook(() =>
      useReplacementAdvice(players, market, 'points'),
    );
    const { result: capped } = renderHook(() =>
      useReplacementAdvice(players, market, 'points', { maxPerTeam: 2 }),
    );

    expect(open.current.options).toHaveLength(1);
    expect(capped.current.options).toHaveLength(0);
  });

  it('hält das Ergebnis über Renders hinweg stabil', () => {
    const players = squad('S');
    const market = [marketPlayer({ teamId: 'X', averagePoints: 200 })];
    const { result, rerender } = renderHook(() =>
      useReplacementAdvice(players, market, 'points'),
    );

    const first = result.current;
    rerender();
    // Referenzgleich: an dieser Memoisierung hängt eine Optimierung pro Listing.
    expect(result.current).toBe(first);
  });
});

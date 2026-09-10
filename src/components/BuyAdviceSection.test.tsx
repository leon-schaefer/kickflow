import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MarketPlayer, Position, SquadPlayer } from '@/api/kickbase';
import { marketPlayer } from '@/test/marketPlayer';
import { squadPlayer } from '@/test/squadPlayer';
import { deriveReplacementAdvice } from '@/utils/replacementAdvice';
import { pointsPerMillion } from '@/utils/valueScore';
import { BuyAdviceSection } from './BuyAdviceSection';

/**
 * Die Sektion wird bewusst gegen die ECHTE Empfehlung getestet
 * (`deriveReplacementAdvice`), nicht gegen ein handgeschriebenes
 * ReplacementAdvice-Objekt: die Zahlen in der Kopfzeile sind der Punkt der
 * Sektion, und ein gestelltes Objekt könnte eine Kombination behaupten, die
 * die Rechnung nie erzeugt. Die Rechnung selbst liegt in
 * src/utils/replacementAdvice.test.ts.
 */
/** 2 GK, 5 DEF, 5 MID, 4 FWD — genug, dass jede Formation besetzbar bleibt. */
function squad(overrides: Partial<SquadPlayer>[] = []): SquadPlayer[] {
  const counts: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 4 };
  const players: SquadPlayer[] = [];
  (Object.keys(counts) as Position[]).forEach((position) => {
    for (let i = 0; i < counts[position]; i++) {
      const averagePoints = 50 - i * 5;
      players.push(
        squadPlayer({
          id: `${position}${i}`,
          name: `${position} ${i}`,
          position,
          teamId: `${position}-${i}`,
          averagePoints,
          totalPoints: averagePoints,
          marketValue: 5_000_000,
          valueScoreAvg: pointsPerMillion(averagePoints, 5_000_000),
        }),
      );
    }
  });
  return players.map((player, index) => ({ ...player, ...overrides[index] }));
}

function setup(players: SquadPlayer[], market: MarketPlayer[]) {
  const onBid = vi.fn();
  const onSelectPlayer = vi.fn();
  const advice = deriveReplacementAdvice({ players, market, metric: 'points' });
  render(
    <BuyAdviceSection
      players={players}
      market={market}
      advice={advice}
      onBid={onBid}
      onSelectPlayer={onSelectPlayer}
    />,
  );
  return { onBid, onSelectPlayer, advice };
}

function toggle() {
  return screen.getByRole('button', { name: /Zukauf/ });
}

describe('BuyAdviceSection', () => {
  it('nennt den besten Ersatz samt Gebot schon zugeklappt', () => {
    setup(squad(), [marketPlayer({ averagePoints: 200 })]);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/Bester Ersatz: Nico Bauer/)).toBeInTheDocument();
    expect(screen.getByText(/bieten/)).toBeInTheDocument();
  });

  it('sagt es, wenn kein Listing die Elf verbessert', () => {
    setup(squad(), [marketPlayer({ averagePoints: 1 })]);
    expect(screen.getByText(/Kein Zukauf verbessert die Elf/)).toBeInTheDocument();
  });

  it('unterscheidet einen leeren Markt von einem ohne Kandidaten', () => {
    setup(squad(), []);
    expect(screen.getByText(/Kein einsatzfähiger Spieler am Transfermarkt/)).toBeInTheDocument();
  });

  it('behauptet während des Ladens keinen leeren Markt', () => {
    const players = squad();
    render(
      <BuyAdviceSection
        players={players}
        market={[]}
        advice={deriveReplacementAdvice({ players, market: [], metric: 'points' })}
        marketPending
      />,
    );
    expect(screen.getByText('Transfermarkt wird geladen …')).toBeInTheDocument();
    expect(screen.queryByText(/Kein einsatzfähiger Spieler/)).not.toBeInTheDocument();
  });

  it('warnt in der Kopfzeile nur über Ausfälle, die wirklich Punkte kosten', () => {
    // GK0 ist der stärkere der beiden Torhüter — sein Ausfall kostet Punkte.
    const withInjuredKeeper = squad([{ status: 'injured' }]);
    const { advice } = setup(withInjuredKeeper, []);

    expect(advice.gaps[0]!.loss).toBeGreaterThan(0);
    expect(screen.getByText(/1 Ausfall in der Elf/)).toBeInTheDocument();
  });

  it('schweigt in der Kopfzeile über einen Ausfall, den die Bank auffängt', () => {
    // MID4 ist der schwächste Mittelfeldspieler und stünde in keiner Elf.
    const players = squad();
    const bench = players.map((p) => (p.id === 'MID4' ? { ...p, status: 'injured' as const } : p));
    setup(bench, []);

    expect(screen.queryByText(/Ausfall in der Elf/)).not.toBeInTheDocument();
  });

  it('zeigt aufgeklappt jeden Ausfall mit seiner Folge', async () => {
    const players = squad();
    const bench = players.map((p) => (p.id === 'MID4' ? { ...p, status: 'injured' as const } : p));
    setup(bench, [marketPlayer({ averagePoints: 200 })]);

    await userEvent.click(toggle());
    expect(screen.getByText(/ohne Folgen — die Bank fängt ihn auf/)).toBeInTheDocument();
  });

  it('zeichnet den besten und den effizientesten Zukauf getrennt aus', async () => {
    setup(squad(), [
      marketPlayer({
        id: 'teuer',
        name: 'Teuer',
        averagePoints: 200,
        marketValue: 40_000_000,
        price: 40_000_000,
      }),
      marketPlayer({
        id: 'billig',
        name: 'Billig',
        averagePoints: 100,
        marketValue: 2_000_000,
        price: 2_000_000,
      }),
    ]);

    await userEvent.click(toggle());
    expect(screen.getByText('★ bester Zugewinn')).toBeInTheDocument();
    expect(screen.getByText('⚡ effizientester')).toBeInTheDocument();
  });

  it('öffnet über den Knopf das Gebot, über die Zeile das Spielerprofil', async () => {
    const { onBid, onSelectPlayer } = setup(squad(), [marketPlayer({ averagePoints: 200 })]);

    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole('button', { name: 'Gebot für Nico Bauer abgeben' }));
    expect(onBid).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    // Der Knopf liegt IN der Zeile — sein Klick darf das Profil nicht mitöffnen.
    expect(onSelectPlayer).not.toHaveBeenCalled();

    // Die Zeile selbst — gesucht über die Begründung darin, denn „Nico Bauer"
    // steht auch in der Kopfzeile und im aria-label des Knopfes.
    await userEvent.click(screen.getByRole('button', { name: /Kommt für/ }));
    expect(onSelectPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });
});

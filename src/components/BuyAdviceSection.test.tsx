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

function setup(
  players: SquadPlayer[],
  market: MarketPlayer[],
  constraints?: { maxPerTeam: number },
) {
  const onBid = vi.fn();
  const onSelectPlayer = vi.fn();
  const onOpenRules = vi.fn();
  const advice = deriveReplacementAdvice({ players, market, metric: 'points', constraints });
  render(
    <BuyAdviceSection
      players={players}
      market={market}
      advice={advice}
      rules={[{ kind: 'maxPerTeam', id: 'maxPerTeam', enabled: true, max: 2 }]}
      onOpenRules={onOpenRules}
      onBid={onBid}
      onSelectPlayer={onSelectPlayer}
    />,
  );
  return { onBid, onSelectPlayer, onOpenRules, advice };
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

  /**
   * Die Regel wirkt längst in der Rechnung (siehe
   * src/utils/replacementAdvice.test.ts) — hier geht es darum, dass man sie
   * SIEHT. Ohne diesen Hinweis fehlt der beste Spieler am Markt kommentarlos
   * in der Liste, und niemand kann erkennen warum.
   */
  it('erklärt einen von der Vereins-Obergrenze geblockten Spieler', async () => {
    // Zwei starke Spieler desselben Vereins in der Elf, ein dritter am Markt.
    const players = squad().map((player) =>
      player.id === 'MID0' || player.id === 'MID1'
        ? { ...player, teamId: 'BAY', averagePoints: 200 }
        : { ...player, teamId: `T-${player.id}` },
    );
    const market = [marketPlayer({ name: 'Harry Kane', teamId: 'BAY', averagePoints: 120 })];
    const { advice, onOpenRules } = setup(players, market, { maxPerTeam: 2 });

    expect(advice.blockedByRule).toHaveLength(1);
    expect(screen.getByText(/1 Spieler wird von deinen Regeln aus der Elf gehalten/)).toBeInTheDocument();

    await userEvent.click(toggle());
    expect(screen.getByText(/Max. 2 Spieler pro Verein — deshalb nicht empfohlen/)).toBeInTheDocument();
    expect(screen.getByText('Harry Kane')).toBeInTheDocument();
    expect(screen.getByText(/Ø-Punkte ohne die Regel/)).toBeInTheDocument();

    // Die naheliegende Rückfrage — „und wenn ein Vereinskollege weicht?" —
    // beantwortet die Zeile gleich mit, samt Preis. Ohne sie liest sich die
    // Regel wie ein Verbot, obwohl sie nur eine Rechnung ist.
    expect(screen.getByText(/Aufstellbar wäre er, wenn MID 1 weicht/)).toBeInTheDocument();
    expect(screen.getByText(/das kostet .* Ø-Punkte/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Regeln ansehen/ }));
    expect(onOpenRules).toHaveBeenCalled();
  });

  /**
   * Der Gegenfall zum Test darüber, und der wichtigere von beiden: ein dritter
   * Spieler desselben Vereins ist NICHT pauschal verboten. Ist er besser als
   * einer der beiden, räumt dieser den Platz — die Elf bleibt regelkonform und
   * er steht als ganz normale Empfehlung in der Liste.
   */
  it('empfiehlt den dritten Spieler eines Vereins, wenn ein Kollege für ihn weicht', async () => {
    const players = squad().map((player) =>
      player.id === 'MID0'
        ? { ...player, teamId: 'BAY', averagePoints: 200 }
        : player.id === 'MID1'
          ? // Stark genug, dass er ohne den Zukauf in der Elf steht — erst dann
            // ist die Quote von 2 wirklich voll und die Regel im Spiel.
            { ...player, teamId: 'BAY', averagePoints: 60 }
          : { ...player, teamId: `T-${player.id}` },
    );
    const market = [marketPlayer({ name: 'Harry Kane', teamId: 'BAY', averagePoints: 120 })];
    const { advice } = setup(players, market, { maxPerTeam: 2 });

    expect(advice.blockedByRule).toHaveLength(0);
    expect(advice.options.map((option) => option.playerId)).toEqual(['m1']);
    expect(screen.getByText(/Bester Ersatz: Harry Kane/)).toBeInTheDocument();

    await userEvent.click(toggle());
    // Der Vereinskollege, der den Platz räumt, wird namentlich genannt — das
    // ist die Information, die aus einem Vorschlag eine Entscheidung macht.
    expect(advice.options[0]!.replacesPlayerIds).toContain('MID1');
    expect(screen.getByText(/MID 1/)).toBeInTheDocument();
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

  it('zeigt das eigene Gebot in der Zeile und bietet an, es zu ändern statt neu zu bieten', async () => {
    // Nach dem eigenen Gebot zählt Kickbase es in offerCount mit.
    setup(squad(), [
      marketPlayer({ averagePoints: 200, offerCount: 1, ownOfferPrice: 10_300_000 }),
    ]);

    // Schon zugeklappt: kein „bieten" für ein Gebot, das längst liegt.
    expect(toggle()).toHaveTextContent(/dein Gebot 10,3 Mio € deckt das/);
    expect(toggle()).not.toHaveTextContent(/bieten/);

    await userEvent.click(toggle());
    expect(screen.getByText('Dein Gebot: 10,3 Mio €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gebot für Nico Bauer ändern' })).toHaveTextContent(
      'Ändern',
    );
    // Das eigene Gebot ist kein Mitbieter — die Begründung nennt keines.
    expect(screen.queryByText(/liegt bereits vor/)).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { LineupData, SquadPlayer, Team } from '@/api/kickbase';
import { squadPlayer } from '@/test/squadPlayer';
import { RulesScreen } from './RulesScreen';

const rules = vi.hoisted(() => ({
  rules: [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: true, max: 2 }] as never[],
  updateRule: vi.fn(),
  loaded: true,
  leagueMax: null as number | null,
}));
const lineup = vi.hoisted(() => ({
  data: undefined as LineupData | undefined,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
}));
const teams = vi.hoisted(() => ({ data: undefined as Team[] | undefined }));

vi.mock('@/lineup/LeagueRulesContext', () => ({ useLeagueRulesContext: () => rules }));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));
vi.mock('@/leagues/useCurrentLeague', () => ({
  useCurrentLeague: () => ({ id: '42', name: 'Kickerrunde' }),
}));
vi.mock('@/queries/hooks', () => ({
  useLineup: () => lineup,
  useCompetitionTeams: () => teams,
}));

function players(): SquadPlayer[] {
  return [
    squadPlayer({ id: '1', teamId: 'b', status: 'fit' }),
    squadPlayer({ id: '2', teamId: 'b', status: 'fit' }),
    squadPlayer({ id: '3', teamId: 'b', status: 'injured' }),
    squadPlayer({ id: '4', teamId: 'd', status: 'fit' }),
  ];
}

function setup() {
  const router = createMemoryRouter([{ path: '/:leagueId/rules', element: <RulesScreen /> }], {
    initialEntries: ['/42/rules'],
  });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  rules.rules = [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: true, max: 2 }] as never[];
  rules.loaded = true;
  rules.leagueMax = null;
  rules.updateRule.mockClear();
  lineup.data = { players: players() } as LineupData;
  teams.data = [
    { id: 'b', name: 'FC Bayern', logoUrl: null },
    { id: 'd', name: 'Dortmund', logoUrl: null },
  ];
});

describe('RulesScreen', () => {
  it('nennt die Liga im Titel', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Regeln · Kickerrunde' })).toBeInTheDocument();
  });

  it('verschweigt die Regelkarte, solange der gespeicherte Stand fehlt', () => {
    rules.loaded = false;
    setup();
    // Sonst stünden hier die DEFAULT_RULES, und ein Klick in diesem Fenster
    // würde vom nachziehenden Storage-Wert überschrieben — und obendrein den
    // falschen Stand persistieren.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('schreibt eine Regeländerung als Patch zurück', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(rules.updateRule).toHaveBeenCalledWith('maxPerTeam', { max: 4 });
  });

  it('zählt den Kader je Verein und markiert das Überschreiten', () => {
    setup();
    // Drei Bayern-Spieler bei max 2.
    expect(screen.getByText('3 Spieler · über Grenze')).toBeInTheDocument();
    expect(screen.getByText('1 Spieler')).toBeInTheDocument();
  });

  it('zählt für die Aufstellbar-Grenze nur einsatzfähige Spieler', () => {
    setup();
    // b: 2 fit (der Verletzte zählt nicht, obwohl er einen Kaderplatz bindet),
    // d: 1 → 3 von 11.
    expect(screen.getByText(/höchstens 3 von 11/)).toBeInTheDocument();
    expect(screen.getByText(/engt die Formation ein/)).toBeInTheDocument();
  });

  it('lässt die Grenze weg, wenn die Regel aus ist', () => {
    rules.rules = [{ id: 'maxPerTeam', kind: 'maxPerTeam', enabled: false, max: 2 }] as never[];
    setup();
    expect(screen.queryByText(/Aufstellbar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/über Grenze/)).not.toBeInTheDocument();
  });

  it('lässt die Kaderkarte weg, solange keine Spieler da sind', () => {
    lineup.data = undefined;
    setup();
    expect(screen.queryByRole('heading', { name: 'Dein Kader' })).not.toBeInTheDocument();
  });

  it('führt zurück in die Aufstellung, wenn keine Herkunft mitkam', () => {
    setup();
    expect(screen.getByRole('link', { name: /Aufstellung/ })).toHaveAttribute(
      'href',
      '/42/lineup',
    );
  });
});

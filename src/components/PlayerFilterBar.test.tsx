import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Team } from '@/api/kickbase';
import { EMPTY_PLAYER_FILTER, type PlayerFilterCriteria } from '@/utils/playerFilter';
import { PlayerFilterBar } from './PlayerFilterBar';

const teams: Team[] = [
  { id: '2', name: 'FC Bayern', logoUrl: 'https://kickbase.test/fcb.svg' },
  { id: '7', name: 'Dortmund', logoUrl: null },
];

function setup(criteria: Partial<PlayerFilterCriteria> = {}, withTeams = true) {
  const onChange = vi.fn();
  const view = render(
    <PlayerFilterBar
      criteria={{ ...EMPTY_PLAYER_FILTER, ...criteria }}
      onChange={onChange}
      teams={withTeams ? teams : undefined}
    />,
  );
  return { onChange, ...view };
}

/** Klappt die Chip-Leiste auf — zugeklappt gibt es nur Suche und Umschalter. */
async function expand() {
  await userEvent.click(screen.getByRole('button', { name: /^Filter/ }));
}

describe('PlayerFilterBar', () => {
  it('beschriftet die Suche, auch ohne sichtbares Label', () => {
    setup();
    expect(screen.getByRole('searchbox', { name: 'Spieler suchen' })).toBeInTheDocument();
  });

  it('meldet die Suchanfrage, ohne die übrigen Kriterien zu verlieren', async () => {
    const { onChange } = setup({ positions: ['MID'] });
    await userEvent.type(screen.getByRole('searchbox'), 'M');
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_PLAYER_FILTER,
      positions: ['MID'],
      query: 'M',
    });
  });

  it('zählt aktive Filter am Umschalter', () => {
    setup({ positions: ['MID', 'FWD'], statuses: ['fit'], teamIds: ['2'] });
    expect(screen.getByRole('button', { name: 'Filter · 4' })).toBeInTheDocument();
  });

  it('nennt keine Zahl, solange nichts gefiltert ist', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('klappt die Chips erst auf Tap auf', async () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Nur fit' })).not.toBeInTheDocument();

    await expand();
    expect(screen.getByRole('button', { name: 'Nur fit' })).toBeInTheDocument();
  });

  it('trägt die Position als Attribut, statt die Farbe im JS zu bauen', async () => {
    setup({ positions: ['MID'] });
    await expand();

    // Vorher `${positionColors[position]}26` im style-Array.
    const mid = screen.getByRole('button', { name: 'MF' });
    expect(mid).toHaveAttribute('data-position', 'MID');
    expect(mid).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ANG' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('nimmt eine Position dazu', async () => {
    const { onChange } = setup();
    await expand();
    await userEvent.click(screen.getByRole('button', { name: 'MF' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PLAYER_FILTER, positions: ['MID'] });
  });

  it('nimmt eine gesetzte Position wieder heraus', async () => {
    const { onChange } = setup({ positions: ['MID', 'FWD'] });
    await expand();
    await userEvent.click(screen.getByRole('button', { name: 'MF' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PLAYER_FILTER, positions: ['FWD'] });
  });

  it('schaltet „Nur fit" um, statt Status zu sammeln', async () => {
    const { onChange } = setup({ statuses: ['fit'] });
    await expand();
    await userEvent.click(screen.getByRole('button', { name: 'Nur fit' }));
    // Leer heißt "keine Einschränkung", nicht "keine Treffer".
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PLAYER_FILTER, statuses: [] });
  });

  it('gibt den Logo-Chips einen Namen', async () => {
    setup();
    await expand();
    // Ohne Label war der Chip vorher ein namenloser Knopf.
    expect(screen.getByRole('button', { name: 'FC Bayern' })).toBeInTheDocument();
  });

  it('lässt die Vereins-Chips weg, wenn keine Teams geladen sind', async () => {
    setup({}, false);
    await expand();
    expect(screen.queryByRole('button', { name: 'FC Bayern' })).not.toBeInTheDocument();
  });

  it('schaltet einen Verein um', async () => {
    const { onChange } = setup();
    await expand();
    await userEvent.click(screen.getByRole('button', { name: 'Dortmund' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PLAYER_FILTER, teamIds: ['7'] });
  });

  it('zeigt „Zurücksetzen" nur bei aktivem Filter', async () => {
    setup();
    await expand();
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
  });

  it('setzt alles zurück, auch die Suche', async () => {
    const { onChange } = setup({ query: 'Mus', positions: ['MID'], teamIds: ['2'] });
    await expand();
    await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(onChange).toHaveBeenCalledWith(EMPTY_PLAYER_FILTER);
  });
});

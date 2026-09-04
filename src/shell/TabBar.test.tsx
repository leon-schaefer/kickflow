import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { TabBar } from './TabBar';

function renderAt(path: string, leagueId = '42') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar leagueId={leagueId} />
    </MemoryRouter>,
  );
}

describe('TabBar', () => {
  it('zeigt alle fünf Tabs in fester Reihenfolge', () => {
    renderAt('/42/lineup');

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      leagueTabTitles.lineup,
      leagueTabTitles.players,
      leagueTabTitles.market,
      leagueTabTitles.league,
      leagueTabTitles.more,
    ]);
  });

  it('verlinkt jeden Tab unter die aktuelle Liga', () => {
    renderAt('/42/lineup', '7');

    expect(screen.getByRole('link', { name: leagueTabTitles.lineup })).toHaveAttribute(
      'href',
      '/7/lineup',
    );
    expect(screen.getByRole('link', { name: leagueTabTitles.market })).toHaveAttribute(
      'href',
      '/7/market',
    );
    expect(screen.getByRole('link', { name: leagueTabTitles.more })).toHaveAttribute(
      'href',
      '/7/more',
    );
  });

  it('markiert genau den Tab der aktuellen Route', () => {
    renderAt('/42/market');

    // aria-current ist gleichzeitig die A11y-Information und der CSS-Hook für
    // die Akzentfarbe — es ersetzt tabBarActiveTintColor.
    expect(screen.getByRole('link', { name: leagueTabTitles.market })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const marked = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(marked).toHaveLength(1);
  });

  it('markiert auf einem Detail-Screen keinen Tab', () => {
    renderAt('/42/player/99');

    expect(
      screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });

  it('ist als Navigationsbereich benannt', () => {
    renderAt('/42/lineup');
    expect(screen.getByRole('navigation', { name: 'Liga-Bereiche' })).toBeInTheDocument();
  });
});

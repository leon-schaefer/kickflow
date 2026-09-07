import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorScreen } from './AppErrorScreen';
import { routes } from './routes';

/**
 * Die Fehlerseite liest ihren Fehler über `useRouteError()` — sie braucht
 * also einen Router um sich und eine Route, die tatsächlich wirft. Ein
 * direktes `render(<AppErrorScreen />)` würde etwas anderes prüfen als das,
 * was in Produktion passiert.
 */
function renderWithError(error: unknown, onReload = () => {}) {
  function Boom(): React.ReactElement {
    throw error;
  }

  const tree: RouteObject[] = [
    { path: '/', element: <Boom />, errorElement: <AppErrorScreen onReload={onReload} /> },
  ];

  return render(<RouterProvider router={createMemoryRouter(tree, { initialEntries: ['/'] })} />);
}

describe('AppErrorScreen', () => {
  it('erklärt einen fehlgeschlagenen Chunk-Import als neue Version', async () => {
    renderWithError(
      new Error('Failed to fetch dynamically imported module: /assets/MarketScreen-C1x9.js'),
    );

    expect(
      await screen.findByRole('heading', { name: 'Neue Version verfügbar' }),
    ).toBeInTheDocument();
    // Die Chunk-URL sagt dem Nutzer nichts — sie gehört nicht auf die Seite.
    expect(screen.queryByText(/assets\/MarketScreen/)).not.toBeInTheDocument();
  });

  it('zeigt bei jedem anderen Fehler dessen Meldung mit', async () => {
    renderWithError(new Error('useLeagueId() muss innerhalb von [leagueId] aufgerufen werden.'));

    expect(
      await screen.findByRole('heading', { name: 'Da ist etwas schiefgelaufen' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('useLeagueId() muss innerhalb von [leagueId] aufgerufen werden.'),
    ).toBeInTheDocument();
  });

  /**
   * Neu geladen wird nur auf Tap — dieselbe Zusage wie beim Update-Banner.
   * Ein Auto-Reload würde einen ungespeicherten Aufstellungs-Entwurf
   * wegwerfen und sich bei einer Ursache, die er nicht behebt, wiederholen.
   */
  it('lädt erst auf Tap neu, nicht von selbst', async () => {
    const onReload = vi.fn();
    renderWithError(new Error('Importing a module script failed.'), onReload);

    const button = await screen.findByRole('button', { name: 'Neu laden' });
    expect(onReload).not.toHaveBeenCalled();

    await userEvent.click(button);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  /** Ohne Live-Region bleibt die Seite für einen Screenreader stumm. */
  it('kündigt sich als Meldung an', async () => {
    renderWithError(new Error('Importing a module script failed.'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  /**
   * React Router legt seine Default-Boundary nur um die WURZEL (`index === 0`
   * in `_renderMatches`) — dort und nur dort ersetzt ein eigenes
   * `errorElement` die englische Standardseite. Ein Baum ohne dieses Attribut
   * wäre der stille Rückfall darauf.
   */
  it('hängt an der Wurzel des echten Route-Baums', () => {
    expect(routes[0]?.errorElement).toBeDefined();
  });
});

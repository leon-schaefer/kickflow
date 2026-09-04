import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { renderRoute } from '@/test/renderRoute';

/**
 * Die URL-Matrix — der Kerntest der Migration.
 *
 * expo-router leitete die Routen aus dem Dateisystem ab; jetzt steht der Baum
 * von Hand in routes.tsx. Ein Tippfehler in einem Pfad wäre sonst erst im
 * Deep Link sichtbar, und genau darauf zeigen PWA-Installationen und
 * Lesezeichen.
 *
 * Geprüft wird in zwei Gruppen, weil die Screens sich unterschiedlich
 * ausweisen — siehe die Kommentare an den beiden Listen.
 */

/**
 * Routen, die sich an ihrer Überschrift erkennen lassen: Login, die beiden
 * Screens außerhalb einer Liga und die vier Detail-Screens.
 */
const TITLED_URLS: { path: string; screen: string }[] = [
  // Der Login trägt keinen AppHeader — er hatte auch unter expo-router keinen
  // (`headerShown: false`), weil es dort nichts zurückzugehen gibt. Seine
  // Überschrift ist der Produktname.
  { path: '/login', screen: 'Kickflow' },
  { path: '/leagues', screen: 'Meine Ligen' },
  { path: '/settings', screen: 'Einstellungen' },
  { path: '/42/player/99', screen: 'Spieler' },
  { path: '/42/manager/7', screen: 'Manager' },
  { path: '/42/rules', screen: 'Regeln' },
  { path: '/42/fixtures', screen: 'Restprogramm' },
];

/**
 * Die fünf Liga-Tabs erkennt man NICHT an der Überschrift: vier von ihnen
 * tragen dort den LeagueSwitcher mit dem Liga-Namen, der Mehr-Tab den festen
 * Text. Stattdessen prüft der Test den Aktiv-Zustand in der Tab-Leiste —
 * `aria-current="page"`, das NavLink aus dem gematchten Pfad ableitet. Das ist
 * genau die Aussage, um die es hier geht (die URL landet in der richtigen
 * Route); was der Screen dann anzeigt, prüfen die Tests neben den Screens.
 */
const TAB_URLS: { path: string; tab: string }[] = [
  { path: '/42/lineup', tab: leagueTabTitles.lineup },
  { path: '/42/players', tab: leagueTabTitles.players },
  { path: '/42/market', tab: leagueTabTitles.market },
  { path: '/42/league', tab: leagueTabTitles.league },
  { path: '/42/more', tab: leagueTabTitles.more },
];

describe('Route-Baum', () => {
  it.each(TITLED_URLS)('$path zeigt „$screen"', async ({ path, screen: name }) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
  });

  it.each(TAB_URLS)('$path aktiviert den Tab „$tab"', async ({ path, tab }) => {
    renderRoute(path);
    const link = await screen.findByRole('link', { name: tab });
    expect(link).toHaveAttribute('aria-current', 'page');
    // Und die URL ist keine 404 — die `*`-Route rendert eine eigene Überschrift.
    expect(screen.queryByRole('heading', { name: 'Nicht gefunden' })).not.toBeInTheDocument();
  });

  it('/ verteilt mit Session auf die Ligenliste', async () => {
    const { router } = renderRoute('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/leagues'));
  });

  it('/ verteilt ohne Session auf den Login', async () => {
    const { router } = renderRoute('/', { session: false });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('leitet /:leagueId auf den ersten Tab — vorher lief das ins Leere', async () => {
    const { router } = renderRoute('/42');
    await waitFor(() => expect(router.state.location.pathname).toBe('/42/lineup'));
  });

  it('zeigt für eine unbekannte URL eine 404-Seite', async () => {
    renderRoute('/42/gibt-es-nicht');
    expect(await screen.findByRole('heading', { name: 'Nicht gefunden' })).toBeInTheDocument();
  });

  it('behandelt ein unbekanntes ERSTES Segment als Liga-ID', async () => {
    // Kein Versehen, sondern unverändertes Verhalten: `:leagueId` matcht jedes
    // einzelne Segment, genau wie `[leagueId]` unter expo-router. Ein Tippfehler
    // in der Liga-ID landet deshalb in der Liga-Ansicht und scheitert dort an
    // der API — nicht auf einer 404-Seite. Festgehalten, damit der Unterschied
    // zur `*`-Route eine Entscheidung bleibt und kein Zufall wird.
    const { router } = renderRoute('/gibt-es-nicht');
    await waitFor(() => expect(router.state.location.pathname).toBe('/gibt-es-nicht/lineup'));
  });

  it('zeigt die Klammer-Gruppen nicht in der URL', async () => {
    // `(app)` und `(tabs)` sind pathless Layout-Routen — die URL bleibt flach.
    const { router } = renderRoute('/42/market');
    await waitFor(() => expect(router.state.location.pathname).toBe('/42/market'));
  });

  it('zeigt die Tab-Leiste auf Tab-Routen und nicht auf Detail-Routen', async () => {
    const tabs = renderRoute('/42/lineup');
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Liga-Bereiche' })).toBeInTheDocument(),
    );
    tabs.unmount();

    renderRoute('/42/player/99');
    expect(await screen.findByRole('heading', { name: 'Spieler' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Liga-Bereiche' })).not.toBeInTheDocument();
  });
});

describe('Auth-Gate', () => {
  it('leitet ohne Session von einer geschützten Route auf den Login', async () => {
    const { router } = renderRoute('/42/lineup', { session: false });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('meldet den Ladezustand, statt vorschnell umzuleiten', () => {
    // token === undefined heißt „Session wird geladen", nicht „kein Login".
    // Ohne diesen Zweig würde ein Reload mitten in der App den Nutzer für
    // einen Frame auf /login werfen.
    const { router } = renderRoute('/42/lineup');
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/42/lineup');
  });

  it('lässt mit Session durch', async () => {
    const { router } = renderRoute('/42/lineup');

    // Der geschützte Baum ist montiert (die Tab-Leiste steckt darin) und die
    // URL wurde nicht umgeleitet. An der Überschrift ließe sich das nicht
    // prüfen: die trägt auf den Liga-Tabs den LeagueSwitcher.
    expect(await screen.findByRole('navigation', { name: 'Liga-Bereiche' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/42/lineup');
  });
});

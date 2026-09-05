import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { type NavOrigin, useBackTarget, withOrigin } from './useBackTarget';

function Probe({ leagueId = '42' }: { leagueId?: string }) {
  const { to, label } = useBackTarget(leagueId);
  return (
    <output>
      {to}|{label}
    </output>
  );
}

function renderWithState(state: NavOrigin | null, leagueId = '42') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/${leagueId}/player/99`, state }]}>
      <Probe leagueId={leagueId} />
    </MemoryRouter>,
  );
}

describe('useBackTarget', () => {
  it('nimmt Ziel und Label aus der mitgegebenen Herkunft', () => {
    renderWithState({ fromPath: '/42/market', fromTitle: 'Markt' });
    expect(screen.getByRole('status')).toHaveTextContent('/42/market|Markt');
  });

  it('deckt den Fall „Spielerprofil aus der Manager-Ansicht" von selbst ab', () => {
    // Früher brauchte das eine Sonderregel (leagueStackTitles), weil der
    // Navigator-State nur „unter mir liegt kein Tab" hergab.
    renderWithState({ fromPath: '/42/manager/7', fromTitle: 'Manager' });
    expect(screen.getByRole('status')).toHaveTextContent('/42/manager/7|Manager');
  });

  it('fällt ohne Herkunft auf den ersten Tab zurück — der Deep-Link-Fall', () => {
    renderWithState(null, '7');
    // Wie bisher: focusedLeagueTabTitle hatte denselben Fallback, weil ein
    // Zurück ohne Tab-State auf dem ersten Tab landet.
    expect(screen.getByRole('status')).toHaveTextContent('/7/lineup|Aufstellung');
  });

  it('fällt ohne Liga-Kontext auf die Ligenliste zurück', () => {
    // `/${''}/lineup` ergäbe `//lineup` — protokollrelativ, also ein Sprung
    // auf den Host `lineup` statt in die App.
    renderWithState(null, '');
    expect(screen.getByRole('status')).toHaveTextContent('/leagues|Meine Ligen');
  });

  it('ergänzt ein fehlendes Ziel', () => {
    renderWithState({ fromTitle: 'Markt' });
    expect(screen.getByRole('status')).toHaveTextContent('/42/lineup|Markt');
  });

  it('ergänzt ein fehlendes Label', () => {
    renderWithState({ fromPath: '/42/market' });
    expect(screen.getByRole('status')).toHaveTextContent('/42/market|Aufstellung');
  });

  // location.state überlebt einen Reload und lässt sich über die History-API
  // auch von außen setzen — als <Link>-Ziel wäre das sonst ein Weg nach
  // draußen. Das Label bleibt erhalten, nur das Ziel fällt auf den Tab zurück.
  it.each([
    ['absolute URL', 'https://example.com'],
    ['protokollrelative URL', '//example.com'],
  ])('verwirft ein Ziel, das aus der App herausführt (%s)', (_name, fromPath) => {
    renderWithState({ fromPath, fromTitle: 'Markt' });
    expect(screen.getByRole('status')).toHaveTextContent('/42/lineup|Markt');
  });
});

describe('withOrigin', () => {
  it('baut den state, den useBackTarget liest', () => {
    expect(withOrigin('/42/market', 'Markt')).toEqual({
      state: { fromPath: '/42/market', fromTitle: 'Markt' },
    });
  });
});

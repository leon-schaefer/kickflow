import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppHeader } from './AppHeader';

function renderHeader(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AppHeader', () => {
  it('zeigt einen Titel als Überschrift', () => {
    renderHeader(<AppHeader title="Meine Ligen" />);
    expect(screen.getByRole('heading', { name: 'Meine Ligen' })).toBeInTheDocument();
  });

  it('nimmt auch einen Knoten als Titel — dort steckt der LeagueSwitcher', () => {
    renderHeader(<AppHeader title={<button type="button">Bundesliga ▾</button>} />);
    expect(screen.getByRole('button', { name: 'Bundesliga ▾' })).toBeInTheDocument();
  });

  it('zeigt den Zurück-Weg mit Label und Ziel', () => {
    renderHeader(<AppHeader title="Spieler" back={{ to: '/42/lineup', label: 'Aufstellung' }} />);

    const back = screen.getByRole('link', { name: 'Aufstellung' });
    expect(back).toHaveAttribute('href', '/42/lineup');
  });

  it('zeigt ohne Zurück-Ziel keinen Link — der Fall der Tab-Header', () => {
    renderHeader(<AppHeader title="Markt" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('rendert den rechten Slot', () => {
    renderHeader(<AppHeader title="Meine Ligen" right={<button type="button">Abmelden</button>} />);
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
  });

  it('lässt das Chevron aus dem Accessible Name heraus', () => {
    renderHeader(<AppHeader title="Spieler" back={{ to: '/42/lineup', label: 'Aufstellung' }} />);

    // Das ‹ ist Dekoration; im Namen des Links hätte es nichts zu suchen.
    expect(screen.getByRole('link')).toHaveAccessibleName('Aufstellung');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryState } from './QueryState';

/**
 * Gemeinsame Hülle für acht Screens, mit einer dokumentierten Fehlergeschichte:
 * ein deaktivierter Query (kein Fehler, nur `enabled: false`) zeigte hier
 * fälschlich eine Fehlermeldung, sobald z.B. ein Tab-Wechsel ihn kurz
 * deaktivierte.
 */
function setup(error: unknown) {
  const refetch = vi.fn().mockResolvedValue(undefined);
  render(<QueryState query={{ error, refetch }} label="Kader" />);
  return { refetch };
}

describe('QueryState', () => {
  it('zeigt ohne Fehler den Ladezustand, nicht eine Fehlermeldung', () => {
    setup(null);
    expect(screen.getByRole('status', { name: 'Lädt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).not.toBeInTheDocument();
  });

  it('zeigt die Meldung des Fehlers, wenn es eine gibt', () => {
    setup(new Error('Kickbase antwortet nicht'));
    expect(screen.getByText('Kickbase antwortet nicht')).toBeInTheDocument();
  });

  it('fällt auf das Label zurück, wenn der Fehler keine Error-Instanz ist', () => {
    setup('irgendwas');
    expect(screen.getByText('Kader konnte nicht geladen werden.')).toBeInTheDocument();
  });

  it('lädt über „Erneut versuchen" neu', async () => {
    const { refetch } = setup(new Error('kaputt'));
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('lässt sich auch im Fehlerzustand ziehen', () => {
    const { refetch } = setup(new Error('kaputt'));

    // Genau der Moment, in dem man instinktiv zieht — deshalb steckt der
    // Fehlerzustand überhaupt in einer Refreshable.
    const wrapper = screen.getByText('kaputt').closest('[style*="--pull-parked"]') as HTMLElement;
    fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(wrapper, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(wrapper, { touches: [] });

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

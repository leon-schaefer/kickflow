import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/renderRoute';

/**
 * Der Update-Banner muss GEMOUNTET sein, nicht nur existieren.
 *
 * Beim Umzug von React Native auf DOM wurde die Komponente portiert, aber
 * nirgends gerendert — build-id.txt wurde weiter geschrieben,
 * register-sw.js verglich weiter, das Event feuerte weiter, und niemand
 * zeigte es an. Nichts daran war sichtbar kaputt, deshalb prüft dieser Test
 * die Kette an ihrem letzten Glied: Event auf `window` rein, Banner raus.
 *
 * Absichtlich am RootLayout und nicht an einem Tab: der Banner soll jede
 * Route überlagern, auch die außerhalb der Liga-Tabs.
 */
describe('RootLayout', () => {
  it('zeigt den Update-Banner erst, wenn register-sw.js einen neuen Deploy meldet', async () => {
    renderRoute('/login');
    await screen.findByRole('heading', { name: 'Kickflow' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('kickflow:update-available'));
    });

    expect(screen.getByRole('button', { name: /Neue Version/ })).toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute';

/**
 * Das Szenario der lange offenen PWA, am echten Route-Baum nachgestellt: sie
 * hing tagelang im Hintergrund, inzwischen wurde deployt, und der Chunk des
 * Markt-Tabs liegt unter seinem alten, gehashten Namen nicht mehr auf dem
 * Server. Der erste Tap auf den Tab lässt damit den dynamischen Import
 * ablehnen.
 *
 * Eine `vi.mock`-Factory, die wirft, ist genau das: der Import des Moduls
 * lehnt ab. Dass Vitest den Fehler dabei in einen eigenen verpackt, ist kein
 * Störgeräusch, sondern deckt zusätzlich ab, dass die Erkennung die
 * `cause`-Kette liest (src/updates/moduleLoadError.ts).
 *
 * Ohne die Fehlerseite endete das hier in React Routers englischem
 * „Unexpected Application Error!" — die ganze App weg, samt Tab-Leiste, ohne
 * ein Bedienelement, das zurückführt. Nachgemessen, bevor dieser Test
 * geschrieben wurde.
 */
vi.mock('@/screens/MarketScreen', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/MarketScreen-C1x9.js');
});

describe('veralteter Chunk beim Tab-Wechsel', () => {
  it('bietet Neuladen an statt die App zu verlieren', async () => {
    renderRoute('/42/lineup');

    await userEvent.click(await screen.findByRole('link', { name: 'Markt' }));

    expect(
      await screen.findByRole('heading', { name: 'Neue Version verfügbar' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  });
});

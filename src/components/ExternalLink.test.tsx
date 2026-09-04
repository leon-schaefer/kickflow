import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalLink } from './ExternalLink';

const openExternalUrl = vi.hoisted(() => vi.fn());
vi.mock('@/support/openExternalUrl', () => ({ openExternalUrl }));

afterEach(() => {
  openExternalUrl.mockReset();
});

describe('ExternalLink', () => {
  it('kündigt sich als Link an, obwohl es ein Button ist', () => {
    render(<ExternalLink url="https://example.com" label="Datenschutz" />);
    // role="link" sagt Screenreadern, dass die App verlassen wird.
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
  });

  it('öffnet die Adresse über openExternalUrl statt per Navigation', async () => {
    openExternalUrl.mockResolvedValue(undefined);
    render(<ExternalLink url="https://example.com" label="Datenschutz" />);

    await userEvent.click(screen.getByRole('link'));
    // Kein <a href>: in der standalone-PWA gäbe es von einer fremden Seite
    // keinen Zurück-Weg.
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('zeigt die Meldung unter dem Link, wenn das Öffnen scheitert', async () => {
    openExternalUrl.mockRejectedValue(new Error('blockiert'));
    render(<ExternalLink url="https://example.com" label="Datenschutz" />);

    await userEvent.click(screen.getByRole('link'));
    expect(await screen.findByText('Die Seite konnte nicht geöffnet werden.')).toBeInTheDocument();
  });

  it('räumt eine alte Meldung beim nächsten Versuch weg', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('blockiert')).mockResolvedValueOnce(undefined);
    render(<ExternalLink url="https://example.com" label="Datenschutz" />);

    await userEvent.click(screen.getByRole('link'));
    expect(await screen.findByText(/nicht geöffnet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link'));
    expect(screen.queryByText(/nicht geöffnet/)).not.toBeInTheDocument();
  });
});

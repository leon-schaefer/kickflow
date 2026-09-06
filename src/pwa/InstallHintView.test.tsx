import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstallHintView } from './InstallHintView';

describe('InstallHintView', () => {
  it('zeigt auf iOS die Teilen-Anleitung und keinen Installieren-Button', () => {
    // Ein Button wäre dort eine Lüge: WebKit gibt der Seite keine
    // Möglichkeit, die Installation auszulösen.
    render(<InstallHintView kind="ios" onInstall={() => {}} onDismiss={() => {}} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Installieren' })).not.toBeInTheDocument();
  });

  it('zeigt auf Android ohne Event die Menü-Anleitung', () => {
    render(<InstallHintView kind="android" onInstall={() => {}} onDismiss={() => {}} />);

    // Nicht auf „App installieren" prüfen — das steht seit der Umformulierung
    // auch in der Überschrift des Dialogs.
    expect(screen.getByText(/Zum Startbildschirm hinzufügen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Installieren' })).not.toBeInTheDocument();
  });

  it('zeigt mit abgefangenem Event den Button statt einer Anleitung', () => {
    const onInstall = vi.fn();
    render(<InstallHintView kind="native" onInstall={onInstall} onDismiss={() => {}} />);

    expect(screen.getByRole('button', { name: 'Installieren' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('meldet Installieren und Wegtippen getrennt', async () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();
    render(<InstallHintView kind="native" onInstall={onInstall} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Installieren' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Später' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('nennt die Symbole für Screenreader beim Namen', () => {
    // Die SVGs sind `aria-hidden`; ohne den Zusatztext bliebe vorgelesen
    // „auf tippen".
    render(<InstallHintView kind="ios" onInstall={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/Teilen-Symbol/)).toBeInTheDocument();
  });
});

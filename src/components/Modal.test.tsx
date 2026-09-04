import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function dialogOf() {
  return document.querySelector('dialog')!;
}

describe('Modal', () => {
  it('hängt geschlossen gar nichts ein', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );
    // Wie RNs `Modal visible={false}`: der Inhalt ist ausgehängt, nicht nur
    // versteckt — OfferModal verlässt sich darauf, um seinen Formularstand
    // zurückzusetzen.
    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('rendert außerhalb des eigenen Teilbaums, direkt am body', () => {
    const { container } = render(
      <Modal open onClose={vi.fn()} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );

    // Das Portal ist Pflicht, nicht Geschmack: im Baum gerendert würden
    // Touch-Events des Dialogs bis zum Pull-to-Refresh-Wrapper hochblubbern.
    expect(container).toBeEmptyDOMElement();
    expect(dialogOf().parentElement).toBe(document.body);
  });

  it('öffnet als echter Modal-Dialog', () => {
    render(
      <Modal open onClose={vi.fn()} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );
    // Ohne showModal() bliebe ein gerendertes <dialog> unsichtbar.
    expect(dialogOf().open).toBe(true);
  });

  it('beschriftet den Dialog mit seinem Titel', () => {
    render(
      <Modal open onClose={vi.fn()} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Liga wechseln' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Liga wechseln' })).toBeInTheDocument();
  });

  it('schließt beim Klick auf den Hintergrund', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );

    await userEvent.click(dialogOf());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('schließt NICHT beim Klick ins Panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );

    // Der Hintergrund ist das dialog-Element selbst; alles im Panel hat ein
    // anderes Ziel. Deshalb braucht das Panel kein stopPropagation mehr.
    await userEvent.click(screen.getByText('Inhalt'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('schließt über die React-Seite, wenn Escape gedrückt wird', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Liga wechseln">
        <p>Inhalt</p>
      </Modal>,
    );

    // Escape löst im Browser `cancel` aus (jsdom nicht — deshalb direkt).
    // Wichtig ist der preventDefault davor: schlösse der Browser selbst,
    // bliebe `open` im State auf true und der Dialog käme nicht wieder.
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialogOf(), cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  });
});

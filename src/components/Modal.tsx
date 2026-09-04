import type { ReactNode, SyntheticEvent } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/utils/cx';
import styles from './Modal.module.css';

interface ModalProps {
  /** Geschlossen wird der Inhalt AUSGEHÄNGT, nicht nur versteckt — wie bei RNs `Modal visible={…}`. */
  open: boolean;
  onClose: () => void;
  /** Überschrift des Panels. Beschriftet zugleich den Dialog. */
  title: string;
  children: ReactNode;
  /** Zusätzliche Klasse fürs Panel, z. B. eine andere Maximalbreite. */
  panelClassName?: string;
}

/**
 * Ersatz für RNs `<Modal transparent>`.
 *
 * Zwei Dinge daran sind nicht Geschmackssache:
 *
 * 1. **Portal nach `document.body`.** react-native-web portalte seine Modals
 *    dorthin, und genau deshalb landeten Touches im offenen Dialog NIE beim
 *    Pull-to-Refresh-Wrapper (die Begründung stand in Refreshable.tsx). Ein im
 *    Baum gerendertes Panel würde seine Touch-Events weiter zu den Vorfahren
 *    hochblubbern — man könnte im offenen Gebots-Dialog versehentlich einen
 *    Refresh auslösen.
 * 2. **`<dialog>` mit `showModal()`.** Bringt Fokusfalle, Top-Layer und die
 *    Escape-Taste mit (= `onRequestClose`), alles ohne eigenen Code.
 *
 * Der Klick auf den Hintergrund trifft das `<dialog>` selbst, nie das Panel
 * darin — deshalb braucht das Panel kein `stopPropagation` mehr, anders als
 * die beiden Pressables der RN-Fassung. Es ist außerdem ein normales `div`
 * und liegt damit nicht mehr unnötig im Tab-Fokus.
 */
export function Modal({ open, onClose, title, children, panelClassName }: ModalProps) {
  if (!open) return null;

  return createPortal(
    <ModalShell onClose={onClose} title={title} panelClassName={panelClassName}>
      {children}
    </ModalShell>,
    document.body,
  );
}

function ModalShell({
  onClose,
  title,
  children,
  panelClassName,
}: Omit<ModalProps, 'open'>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // Erst `showModal()` macht daraus einen echten Modal-Dialog; ein
    // gerendertes `<dialog>` ohne den Aufruf bleibt unsichtbar.
    dialogRef.current?.showModal();
  }, []);

  function handleBackdropClick(event: SyntheticEvent<HTMLDialogElement>) {
    // Der Hintergrund IST das dialog-Element; alles im Panel hat ein anderes
    // Ziel.
    if (event.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={title}
      onClick={handleBackdropClick}
      onCancel={(event) => {
        // Escape: das Schließen übernimmt der React-State, nicht der Browser —
        // sonst bliebe `open` auf true und der Dialog käme nicht wieder.
        event.preventDefault();
        onClose();
      }}
    >
      <div className={cx(styles.panel, panelClassName)}>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

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
 *
 * Den Anfangsfokus setzt der Dialog selbst — und zwar auf das erste
 * bedienbare Element darin. Das ist hier nicht erwünscht: WebKit zeichnet den
 * Fokusring auch dann, wenn der Dialog per Tap geöffnet wurde, und er blieb
 * bis zur nächsten Berührung als blauer Rand um den ersten Eintrag stehen.
 * Der Fokus geht deshalb aufs Panel (siehe `panelRef`) — das ist ohnehin die
 * bessere Ansage: Screenreader lesen den Dialog von oben, nicht ab dem ersten
 * Listeneintrag.
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Erst `showModal()` macht daraus einen echten Modal-Dialog; ein
    // gerendertes `<dialog>` ohne den Aufruf bleibt unsichtbar.
    dialogRef.current?.showModal();
    // Direkt danach, im selben Zug: `showModal()` hat den Fokus schon auf das
    // erste bedienbare Element gesetzt, gezeichnet wird aber erst nach diesem
    // Effekt — der Ring dort blitzt also nicht auf. `autoFocus` wäre kein
    // Ersatz: React ruft es nur für button/input/select/textarea auf und
    // rendert das Attribut nicht, ein `div` bliebe unbeachtet.
    panelRef.current?.focus();
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
      {/* `tabIndex={-1}`: fokussierbar für den Zeiger und für Skripte, aber
          nicht in der Tab-Reihenfolge. Tab führt von hier zum ersten
          Bedienelement im Panel. */}
      <div ref={panelRef} tabIndex={-1} className={cx(styles.panel, panelClassName)}>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

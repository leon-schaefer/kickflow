import { useState } from 'react';
import { openExternalUrl } from '@/support/openExternalUrl';
import styles from './ExternalLink.module.css';

interface ExternalLinkProps {
  url: string;
  label: string;
  /** Kompakt = Fußzeile (Login), sonst Kartenzeile mit 44px Trefferfläche. */
  compact?: boolean;
}

/**
 * Textlink auf eine Seite außerhalb der App (Homepage, Datenschutz).
 *
 * Kein `<a href>`, sondern `openExternalUrl` (src/support/openExternalUrl.ts):
 * das öffnet über `window.open` einen neuen Tab, weil die installierte PWA
 * standalone läuft und bei einer Navigation im aktuellen Tab keinen
 * Zurück-Weg hätte.
 *
 * `role="link"` an einem `<button>`: Screenreader kündigen damit an, dass die
 * App verlassen wird, während Tastaturbedienung und Fokus die des Buttons
 * bleiben. Ein echtes `<a>` wäre idiomatischer, verlöre aber die Behandlung
 * eines blockierten Popups unten.
 *
 * Der Fehlerzustand hängt am Link und nicht am Screen — die Meldung soll
 * unter dem angetippten Link stehen und nicht irgendwo auf der Karte.
 */
export function ExternalLink({ url, label, compact = false }: ExternalLinkProps) {
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    try {
      await openExternalUrl(url);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <button
        type="button"
        role="link"
        onClick={handleClick}
        className={compact ? styles.compact : styles.full}
      >
        {label}
      </button>
      {failed && <p className={styles.error}>Die Seite konnte nicht geöffnet werden.</p>}
    </div>
  );
}

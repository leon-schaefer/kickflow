import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { BackTarget } from './useBackTarget';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  /** String oder Knoten — im Tab-Header steckt hier der LeagueSwitcher. */
  title: ReactNode;
  /** Fehlt bei Tab-Headern: dort gibt es keinen Zurück-Weg. */
  back?: BackTarget;
  /** Rechter Slot, z.B. der LogoutButton im Ligen-Picker. */
  right?: ReactNode;
}

/**
 * Kopfzeile der App — Ersatz für die Header von `<Stack>` und `<Tabs>`.
 *
 * Eine Komponente für alle drei bisherigen Varianten: Tab-Header (zentrierter
 * Titel ohne Zurück), Detail-Header (Zurück mit Label plus Titel) und der
 * Ligen-Picker (Titel plus rechter Slot).
 *
 * Ersetzt damit auch die deklarativen `<Stack.Title>`- und
 * `<Stack.Screen.BackButton>`-Slots, die in den Detail-Screens je zwei- bis
 * dreimal auftauchten — einmal pro Render-Zweig, damit der Zurück-Pfeil auch
 * im Lade- und Fehlerzustand beschriftet ist. Als normale Komponente im
 * Screen-Layout steht sie einmal da und gilt für alle Zweige.
 */
export function AppHeader({ title, back, right }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.side}>
        {back ? (
          <Link to={back.to} className={styles.back}>
            <span aria-hidden="true" className={styles.chevron}>
              ‹
            </span>
            <span className={styles.backLabel}>{back.label}</span>
          </Link>
        ) : null}
      </div>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.sideEnd}>{right}</div>
    </header>
  );
}

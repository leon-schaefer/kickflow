import { Link } from 'react-router';
import { AppHeader } from '@/shell/AppHeader';
import styles from './NotFound.module.css';

/**
 * Neu gegenüber Expo: dort gab es kein `+not-found`. Weil der Rewrite in
 * vercel.json jeden Pfad an die SPA liefert, landete eine unbekannte URL
 * vorher im Default-404 von expo-router.
 */
export function NotFound() {
  return (
    <>
      <AppHeader title="Nicht gefunden" />
      <div className={styles.body}>
        <p className={styles.text}>Diese Seite gibt es nicht.</p>
        <Link to="/" className={styles.link}>
          Zur Startseite
        </Link>
      </div>
    </>
  );
}

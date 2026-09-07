import { useRouteError } from 'react-router';
import { isModuleLoadError } from '@/updates/moduleLoadError';
import styles from './AppErrorScreen.module.css';

/**
 * Das `errorElement` der Wurzelroute — die letzte Auffangstelle der App.
 *
 * Vorher stand hier React Routers Default: eine weiße Seite mit „Unexpected
 * Application Error!", dem Stacktrace darunter und keinem Bedienelement. Das
 * ist für den häufigsten Fall, der hier landet, sogar irreführend — ein
 * fehlgeschlagener Chunk-Import nach einem Redeploy ist kein Absturz, sondern
 * eine veraltete Sitzung (Begründung in src/updates/moduleLoadError.ts).
 *
 * Neu geladen wird ausschließlich per Tap, nie von selbst. Dieselbe Zusage
 * wie beim Update-Banner (src/components/UpdateBanner.tsx) und beim Wächter
 * (src/pwa/resumeGuard.ts): ein automatisches Reload könnte einen
 * ungespeicherten Aufstellungs-Entwurf wegwerfen — und ein Reload, der die
 * Ursache nicht behebt, würde sich sonst in einer Schleife wiederholen.
 *
 * `onReload` ist injizierbar, weil jsdom kein `location.reload()` kann; im
 * Route-Baum steht die Komponente ohne Prop.
 */
export function AppErrorScreen({
  onReload = () => window.location.reload(),
}: {
  onReload?: () => void;
}) {
  const error = useRouteError();
  const stale = isModuleLoadError(error);

  return (
    <div className={styles.screen} role="alert">
      <h1 className={styles.title}>
        {stale ? 'Neue Version verfügbar' : 'Da ist etwas schiefgelaufen'}
      </h1>
      <p className={styles.body}>
        {stale
          ? 'Diese Sitzung läuft noch auf einer älteren Fassung von kickflow. Einmal neu laden, dann geht es weiter.'
          : 'Die Ansicht konnte nicht angezeigt werden. Neu laden hilft meistens.'}
      </p>
      <button type="button" className={styles.action} onClick={onReload}>
        Neu laden
      </button>
      {/*
        Die Meldung nur im anderen Zweig: beim veralteten Chunk sagt sie
        nichts, was der Text oben nicht besser sagt. Beim unbekannten Fehler
        ist sie das Einzige, was der Nutzer ins Feedback-Formular kopieren
        kann.
      */}
      {!stale && errorMessage(error) !== null ? (
        <p className={styles.detail}>{errorMessage(error)}</p>
      ) : null}
    </div>
  );
}

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return null;
}

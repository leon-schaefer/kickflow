import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { PRIVACY_PATH, PRIVACY_TITLE } from '@/legal/legalRoutes';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget, withOrigin } from '@/shell/useBackTarget';
import localStore from '@/storage/local';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './SettingsScreen.module.css';

/**
 * Einstellungen: Abmelden und das Löschen der lokalen Daten. Erreichbar über
 * den Fuß des LeagueSwitchers.
 *
 * Hier standen bis zum Web-only-Umbau auch die Benachrichtigungs-Schalter
 * (Aufstellungs-Deadline, ablaufendes Gebot). Die liefen über
 * expo-notifications und damit ausschließlich nativ — im Browser zeigte der
 * Screen an dieser Stelle nur "Auf Web/PWA nicht verfügbar". Ein Ersatz über
 * Web Push bräuchte einen eigenen Server, den kickflow nicht hat.
 *
 * ## Warum „Lokale Daten löschen" hier steht und kein Cookie-Banner existiert
 *
 * kickflow setzt keine Cookies und lädt keine Analyse-Skripte; der lokale
 * Speicher hält ausschließlich die Anmeldung und Einstellungen, die der
 * Nutzer selbst gesetzt hat. Damit greift § 25 Abs. 2 Nr. 2 TTDSG (unbedingt
 * erforderlich für den gewünschten Dienst) und eine Einwilligung ist nicht
 * einzuholen — ein Banner hätte hier nichts, worüber es abstimmen ließe, und
 * wäre ein Klick, der Zustimmung zu etwas suggeriert, das gar nicht passiert.
 *
 * Was ein Banner nicht leistet, aber gefordert IST, ist die Kontrolle über
 * die Daten (Art. 17 DSGVO): sehen, was gespeichert ist, und es entfernen
 * können. Das Sehen leistet die Tabelle in der Datenschutzerklärung (aus
 * `storage/inventory.ts`, dorthin verlinkt), das Entfernen dieser Knopf.
 */
export function SettingsScreen() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  // Der Screen liegt außerhalb einer Liga; ohne Herkunft im state führt
  // Zurück deshalb auf die Ligenliste statt auf einen Liga-Tab.
  const back = useBackTarget('');
  /**
   * Zweistufig statt sofort. Bewusst kein `window.confirm`: der Dialog ist in
   * der installierten PWA ein Systemfenster, das aus der App herausfällt, und
   * auf iOS lässt er sich nicht gestalten. Der zweite Knopf steht an
   * derselben Stelle wie der erste — das ist die Bestätigung, die zählt.
   */
  const [confirming, setConfirming] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleClearData() {
    // Reihenfolge ist wichtig: erst alles löschen, dann abmelden. Umgekehrt
    // schriebe `logout()` beim Aufräumen der Session noch einmal in den
    // Speicher, und der Eintrag stünde nach dem „Löschen" wieder da.
    localStore.clearAppData();
    // `logout()` bringt den Auth-State auf „nicht angemeldet" und leert den
    // Query-Cache. Ohne diesen Schritt liefe die App mit einem Token weiter,
    // das im Speicher schon weg ist — bis zum nächsten Reload.
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <AppHeader title="Einstellungen" back={back} />
      <div className={styles.scroll}>
        <div className={styles.content}>
          <button
            type="button"
            className={cx(layout.pressable, styles.logoutButton)}
            onClick={handleLogout}
          >
            Abmelden
          </button>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Lokale Daten</h2>
            <p className={styles.cardBody}>
              kickflow speichert deine Anmeldung, die zuletzt genutzte Liga, deine
              Aufstellungs-Regeln und deine Verkaufs-Ausschlüsse auf diesem Gerät. Nichts davon
              wird übertragen oder ausgewertet.
            </p>
            <Link
              to={PRIVACY_PATH}
              className={styles.inlineLink}
              state={withOrigin('/settings', 'Einstellungen').state}
            >
              Was genau gespeichert wird ({PRIVACY_TITLE})
            </Link>

            {confirming ? (
              <>
                <p className={styles.warning} role="alert">
                  Löscht alle lokalen Daten und meldet dich ab. Dein Kickbase-Konto und deine
                  Ligen bleiben unberührt — sie liegen bei Kickbase, nicht hier.
                </p>
                <div className={styles.confirmRow}>
                  <button
                    type="button"
                    className={cx(layout.pressable, styles.dangerButton)}
                    onClick={handleClearData}
                  >
                    Endgültig löschen
                  </button>
                  <button
                    type="button"
                    className={cx(layout.pressable, styles.cancelButton)}
                    onClick={() => setConfirming(false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className={cx(layout.pressable, styles.dangerButton)}
                onClick={() => setConfirming(true)}
              >
                Lokale Daten löschen
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

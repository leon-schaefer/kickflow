import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { LogoutButton } from '@/auth/LogoutButton';
import { ExternalLink } from '@/components/ExternalLink';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { AppHeader } from '@/shell/AppHeader';
import { HOMEPAGE_URL, PRIVACY_URL } from '@/support/links';
import { openExternalUrl } from '@/support/openExternalUrl';
import { SUPPORT_URL } from '@/support/supportUrl';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './MoreScreen.module.css';

/**
 * Letzter Tab neben Aufstellung/Spieler/Markt/Liga: alles, was nicht zur
 * Liga gehört. Kartenaufbau folgt dem Regel-Screen (surface + 1px border +
 * radius.lg).
 *
 * Kein Refreshable/QueryState wie in den anderen Tabs — dieser Screen stellt
 * keine Kickbase-Anfrage, es gäbe nichts zu aktualisieren.
 *
 * Als einziger der fünf Tabs trägt er nicht den LeagueSwitcher als Titel,
 * sondern den festen Text: hier ist nichts liga-spezifisch. Genau diese
 * Ausnahme ist der Grund, warum der Header in den Tabs steckt und nicht im
 * gemeinsamen TabsLayout.
 */
export function MoreScreen() {
  const { userName } = useAuth();
  const [linkFailed, setLinkFailed] = useState(false);

  async function handleSupport() {
    if (!SUPPORT_URL) return;
    setLinkFailed(false);
    try {
      await openExternalUrl(SUPPORT_URL);
    } catch {
      setLinkFailed(true);
    }
  }

  return (
    <>
      <AppHeader title={leagueTabTitles.more} />
      <div className={styles.scroll}>
        <div className={styles.content}>
          {/*
           * Ohne VITE_SUPPORT_URL erscheint die Karte gar nicht — ein
           * Spenden-Button, der auf einen toten Link zeigt, ist schlechter als
           * keiner (siehe src/support/supportUrl.ts).
           */}
          {SUPPORT_URL && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>kickflow unterstützen</h2>
              <p className={styles.cardBody}>
                kickflow ist kostenlos und bleibt es — Optimizer, Pflichtverkauf und
                Kaufempfehlungen inklusive. Wenn dir die App den Spieltag erleichtert, freue ich
                mich über Unterstützung bei der Weiterentwicklung. Freiwillig, einmalig,
                jederzeit.
              </p>
              <button
                type="button"
                className={cx(layout.pressableH, styles.supportButton)}
                onClick={handleSupport}
              >
                Unterstützen
              </button>
              <p className={styles.hint}>
                Öffnet eine externe Seite. In kickflow ändert sich dadurch nichts.
              </p>
              {linkFailed && (
                <p className={styles.error} role="alert">
                  Die Seite konnte nicht geöffnet werden.
                </p>
              )}
            </section>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Konto</h2>
            {/*
             * userName wird mit der Session gespeichert und beim Start wieder
             * eingelesen (siehe tokenStore.StoredSession), überlebt also einen
             * Neustart. Der Fallback bleibt trotzdem: Sessions von vor dieser
             * Persistierung tragen den Namen nicht, und die Login-Antwort
             * liefert ihn nur laut unverifizierter Doku (toAuthSession).
             */}
            <p className={styles.cardBody}>
              {userName ? `Angemeldet als ${userName}.` : 'Mit deinem Kickbase-Konto angemeldet.'}
            </p>
            <LogoutButton />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Über kickflow</h2>
            <p className={styles.cardBody}>
              Inoffizieller Begleiter für Kickbase. Nicht mit der Kickbase GmbH verbunden.
            </p>
            {/*
             * Datenschutz muss aus der App heraus erreichbar sein (DSGVO).
             * Beide Seiten liegen auf codewithleon.dev — siehe
             * src/support/links.ts.
             */}
            <ExternalLink url={HOMEPAGE_URL} label="Homepage" />
            <ExternalLink url={PRIVACY_URL} label="Datenschutz" />
            {/*
             * Version und Commit kommen aus `define` in vite.config.ts —
             * vorher aus expo-constants (`expoConfig.version` und
             * `extra.gitSha`), das mit app.config.js verschwunden ist. Die
             * Version hat damit nur noch eine Quelle: die package.json.
             */}
            <p className={styles.version}>
              Version {__APP_VERSION__}
              {__GIT_SHA__ ? ` (${__GIT_SHA__})` : ''}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

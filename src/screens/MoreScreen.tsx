import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { LogoutButton } from '@/auth/LogoutButton';
import { ExternalLink } from '@/components/ExternalLink';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { AppHeader } from '@/shell/AppHeader';
import { withOrigin } from '@/shell/useBackTarget';
import { HOMEPAGE_URL, PRIVACY_URL } from '@/support/links';
import { openExternalUrl } from '@/support/openExternalUrl';
import {
  browserShareTarget,
  type InviteOutcome,
  inviteUrl,
  shareInvite,
} from '@/support/shareInvite';
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
  const { pathname } = useLocation();
  const [linkFailed, setLinkFailed] = useState(false);
  const [invite, setInvite] = useState<InviteOutcome | null>(null);

  /*
   * `shareInvite` MUSS direkt am Klick hängen: `navigator.share` verlangt eine
   * frische Nutzer-Geste und wirft, wenn davor noch etwas anderes awaited
   * wurde. Deshalb steht hier kein Aufräumen vor dem Aufruf — der alte
   * Rückmeldungstext wird erst mit dem Ergebnis überschrieben.
   */
  async function handleInvite() {
    setInvite(await shareInvite(inviteUrl(), browserShareTarget()));
  }

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
           * Ganz oben, und das mit Absicht: der Weg, auf dem kickflow Nutzer
           * findet, führt über die Liga-Gruppenchats seiner Nutzer. Ohne diese
           * Karte gibt es dafür nur „URL abschreiben" — in der installierten
           * PWA nicht einmal das, dort fehlt die Adressleiste.
           */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Liga-Kollegen einladen</h2>
            <p className={styles.cardBody}>
              kickflow lohnt sich am meisten, wenn deine Liga mitspielt. Teile den Link — der
              Rest ist eine Anmeldung mit dem Kickbase-Konto.
            </p>
            <button
              type="button"
              className={cx(layout.pressableH, styles.cardButton)}
              onClick={handleInvite}
            >
              Link teilen
            </button>
            {invite === 'copied' && (
              <p className={styles.hint} role="status">
                Link kopiert — jetzt in den Liga-Chat einfügen.
              </p>
            )}
            {invite === 'failed' && (
              /*
               * Der Link steht hier im Klartext, statt dass die Meldung auf die
               * Adressleiste verweist: in der installierten PWA gibt es keine.
               * Ein „kopier es dir aus der Adresszeile" wäre dort genau für die
               * Nutzer nutzlos, die am ehesten teilen wollen.
               */
              <p className={styles.error} role="alert">
                Teilen hat nicht funktioniert. Der Link lautet:{' '}
                <span className={styles.inviteUrl}>{inviteUrl()}</span>
              </p>
            )}
          </section>

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
                className={cx(layout.pressableH, styles.cardButton)}
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

          {/*
           * Ein `<Link>` und kein Button: das ist eine Navigation, und ein
           * echtes `<a href>` erlaubt „in neuem Tab öffnen" und zeigt das
           * Ziel in der Statusleiste. Die Herkunft geht als state mit, damit
           * Zurück von dort hierher führt und nicht in die Ligenliste — der
           * Feedback-Screen liegt außerhalb von `/:leagueId` und hat sonst
           * keinen Tab, auf den er zurückfallen könnte.
           */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Feedback & Wünsche</h2>
            <p className={styles.cardBody}>
              Ein Fehler, eine fehlende Funktion oder eine Idee? Schreib es mir — die App wächst
              genau daran.
            </p>
            <Link
              to="/feedback"
              state={withOrigin(pathname, leagueTabTitles.more).state}
              className={cx(layout.pressableH, styles.cardButton, styles.cardLink)}
            >
              Feedback geben
            </Link>
          </section>

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

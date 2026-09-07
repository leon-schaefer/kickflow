import { Link, useLocation } from 'react-router';
import { STORAGE_INVENTORY, STORAGE_KEY_PREFIX } from '@/storage/inventory';
import { HOMEPAGE_URL } from '@/support/links';
import { ExternalLink } from '@/components/ExternalLink';
import { withOrigin } from '@/shell/useBackTarget';
import { LegalPage } from './LegalPage';
import { PRIVACY_TITLE, TERMS_PATH, TERMS_TITLE } from './legalRoutes';
import styles from './LegalPage.module.css';

/**
 * Datenschutzerklärung, in der App gerendert.
 *
 * Bis hierher verlinkte die App nur auf eine Seite auf codewithleon.dev (siehe
 * die alte Begründung in src/support/links.ts). Drei Dinge sprechen dafür, den
 * Text HIER zu haben, und sie sind der Grund für die Änderung:
 *
 *   1. Die installierte PWA läuft standalone. Der externe Link öffnet einen
 *      Browser-Tab und reißt damit genau bei der Seite aus der App, die
 *      erreichbar sein MUSS — und offline gar nicht erreichbar ist, obwohl der
 *      Service Worker den Rest der App vorhält.
 *   2. Die Speicher-Auskunft unten kann nur hier stehen. Sie kommt aus
 *      `STORAGE_INVENTORY`, und die ist an keys.ts gekoppelt (inventory.test.ts).
 *      Eine Seite in einem anderen Repository veraltet bei jedem neuen
 *      localStorage-Schlüssel, ohne dass es auffällt — bei einer
 *      Rechtsseite ist genau das der Schaden.
 *   3. Ein interner Pfad ist zitierfähig und indexierbar (sitemap.xml), ohne
 *      dass eine zweite Domain im Spiel ist.
 *
 * Die Homepage bleibt extern verlinkt — sie ist ein Produkt-Auftritt und
 * nichts, was die App vorhalten müsste.
 *
 * INHALTLICHER VORBEHALT: Der Text beschreibt wahrheitsgemäß, was der Code
 * tut, und ist keine Rechtsberatung. Wer betreibt (Verantwortlicher im Sinne
 * von Art. 4 Nr. 7 DSGVO), muss den Abschnitt „Verantwortlicher" mit seinen
 * eigenen Angaben belegen — die stehen im Impressum auf codewithleon.dev und
 * absichtlich nicht hier hartkodiert.
 */
export function PrivacyScreen() {
  const location = useLocation();

  return (
    <LegalPage title={PRIVACY_TITLE} updated="2026-09-07">
      <p className={styles.lead}>
        kickflow ist eine reine Browser-App ohne eigenen Server. Es gibt keine Konten bei uns,
        keine Datenbank und keine Übermittlung an Dritte zu Werbe- oder Analysezwecken. Was die
        App braucht, spricht dein Browser direkt mit Kickbase; was sie sich merkt, bleibt auf
        deinem Gerät.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Verantwortlicher</h2>
        <p className={styles.text}>
          Verantwortlich für die Verarbeitung im Sinne von Art. 4 Nr. 7 DSGVO ist der Betreiber
          von kickflow. Die vollständigen Kontaktangaben stehen im Impressum auf der Projektseite.
        </p>
        <ExternalLink url={HOMEPAGE_URL} label="Impressum und Kontakt (codewithleon.dev)" />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Keine Cookies, keine Analyse, kein Tracking</h2>
        <p className={styles.text}>
          kickflow setzt keine Cookies. Es gibt keine Reichweitenmessung, kein Analyse-Werkzeug,
          keine Werbung, keine Social-Media-Plugins und keine sonstigen Skripte Dritter. Die
          Auslieferung erlaubt per Content-Security-Policy ausschließlich Skripte aus eigener
          Herkunft — fremder Code kann in dieser App technisch nicht ausgeführt werden.
        </p>
        <p className={styles.text}>
          Deshalb findest du hier auch kein Zustimmungsbanner: § 25 Abs. 2 Nr. 2 TTDSG nimmt
          Zugriffe auf dein Gerät von der Einwilligung aus, die für den ausdrücklich gewünschten
          Dienst unbedingt erforderlich sind. Genau das ist der lokale Speicher unten — er hält
          deine Anmeldung und deine eigenen Einstellungen, sonst nichts. Es gäbe nichts, wozu ein
          Banner dir eine Wahl anbieten könnte.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Anmeldung und Kickbase</h2>
        <p className={styles.text}>
          Zum Anmelden gibst du deine Kickbase-Zugangsdaten ein. Sie werden von deinem Browser
          direkt an die Kickbase-API (api.kickbase.com) gesendet — sie erreichen keinen Server von
          kickflow, weil es keinen gibt. Dein Passwort wird nicht gespeichert: es geht einmal an
          Kickbase und wird danach verworfen. Zurück kommt ein Zugriffstoken, das lokal auf deinem
          Gerät liegt (siehe Tabelle unten).
        </p>
        <p className={styles.text}>
          Alle weiteren Daten — Ligen, Kader, Marktwerte, Spielpläne, Tabellen — lädt die App bei
          jeder Nutzung frisch von Kickbase und hält sie nur im Arbeitsspeicher, solange die App
          offen ist. Für die Verarbeitung dieser Daten und für deinen Kickbase-Account ist die
          Kickbase GmbH verantwortlich; deren Datenschutzerklärung gilt dafür unabhängig von
          dieser.
        </p>
        <p className={styles.text}>
          Spielerbilder und Vereinslogos lädt dein Browser vom Kickbase-Bilddienst
          (kickbase.b-cdn.net). Dabei erfährt dieser Dienst — wie bei jedem Bildaufruf im Web —
          deine IP-Adresse.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hosting</h2>
        <p className={styles.text}>
          Die App selbst (HTML, JavaScript, Bilder) wird von Vercel ausgeliefert. Beim Abruf
          verarbeitet Vercel als Auftragsverarbeiter technisch notwendige Zugriffsdaten,
          insbesondere deine IP-Adresse, Zeitpunkt und angeforderte Datei. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. f DSGVO — ohne diese Verarbeitung lässt sich eine Webseite nicht
          ausliefern. Die Verbindung ist ausschließlich per HTTPS möglich.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Was auf deinem Gerät gespeichert wird</h2>
        <p className={styles.text}>
          kickflow legt die folgenden Einträge im lokalen Speicher deines Browsers
          (localStorage) ab. Diese Daten verlassen dein Gerät nicht — sie werden nicht übertragen,
          nicht ausgewertet und sind für uns nicht einsehbar.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.tableCaption}>Lokal gespeicherte Einträge</caption>
            <thead>
              <tr>
                <th scope="col">Eintrag</th>
                <th scope="col">Zweck</th>
                <th scope="col">Speicherdauer</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE_INVENTORY.map((entry) => (
                <tr key={entry.key}>
                  <th scope="row">
                    {entry.label}
                    <br />
                    <span className={styles.key}>{entry.key}</span>
                    {entry.personal && (
                      <>
                        <br />
                        <span className={styles.personalTag}>personenbezogen</span>
                      </>
                    )}
                  </th>
                  <td>{entry.purpose}</td>
                  <td>{entry.lifetime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.text}>
          Du kannst diese Daten jederzeit selbst und vollständig entfernen: in den Einstellungen
          über „Lokale Daten löschen". Das entfernt alle Einträge, die mit{' '}
          <span className={styles.key}>{STORAGE_KEY_PREFIX}</span> beginnen, und meldet dich
          dabei ab. Dasselbe erreichst du über die Website-Daten deines Browsers.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deine Rechte</h2>
        <p className={styles.text}>
          Dir stehen die Rechte aus Art. 15 bis 21 DSGVO zu: Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem kannst du
          dich bei einer Datenschutz-Aufsichtsbehörde beschweren.
        </p>
        <p className={styles.text}>
          Praktisch heißt das hier zweierlei. Erstens: Daten, die kickflow selbst hält, gibt es
          nicht — es gibt keinen Server und keine Datenbank, in der etwas über dich stünde. Die
          Auskunft besteht in dieser Erklärung, und die Löschung führst du mit „Lokale Daten
          löschen" selbst und sofort aus. Zweitens: Ansprüche, die deinen Kickbase-Account und die
          dort gespeicherten Spieldaten betreffen, richten sich an die Kickbase GmbH — nur dort
          liegen diese Daten.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Änderungen</h2>
        <p className={styles.text}>
          Ändert sich die App in einer Weise, die diese Erklärung berührt, wird sie mit
          angepasst. Das Datum am Ende der Seite nennt den Stand der aktuellen Fassung.
        </p>
        <Link
          to={TERMS_PATH}
          className={styles.crossLink}
          state={withOrigin(location.pathname, PRIVACY_TITLE).state}
        >
          {TERMS_TITLE} lesen
        </Link>
      </section>
    </LegalPage>
  );
}

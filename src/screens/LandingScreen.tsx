import { Link } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import {
  PRIVACY_PATH,
  PRIVACY_TITLE,
  TERMS_PATH,
  TERMS_TITLE,
} from '@/legal/legalRoutes';
import { withOrigin } from '@/shell/useBackTarget';
import { HOMEPAGE_URL, REPOSITORY_URL } from '@/support/links';
import styles from './LandingScreen.module.css';

/**
 * Die öffentliche Startseite — das, was jemand sieht, der den Link zum ersten
 * Mal antippt.
 *
 * Vorher stand an `/` nur ein Redirect: ohne Session ging es sofort auf den
 * Login. Wer kickflow noch nie gesehen hat, landete damit als Erstes vor einem
 * Feld für sein KICKBASE-PASSWORT — die Frage, die er an dieser Stelle
 * unmöglich beantworten kann. Diese Seite beantwortet sie zuerst und schickt
 * ihn danach weiter.
 *
 * Sie rendert NUR im Browser-Tab. In der installierten PWA führt `/` weiter
 * direkt auf den Login (src/routes/IndexRoute.tsx): dort ist `/` die
 * `start_url` aus dem Manifest, und wer die App auf dem Startbildschirm hat,
 * braucht keine Seite mehr, die ihm die App erklärt.
 *
 * Die Breite bleibt die der App (`--layout-max-content-width`, 480px). Das ist
 * eine Entscheidung und kein Versehen: fast jeder kommt über einen geteilten
 * Link aus einem Liga-Gruppenchat und damit vom Telefon. Aus dem Rahmen des
 * RootLayout auszubrechen hieße, dessen `max-width` löchrig zu machen — die
 * trägt jeden anderen Screen.
 *
 * Was hier steht, muss der App entsprechen. Jeder Punkt unten ist eine
 * Funktion, die es gibt: der Optimizer je Formation
 * (src/lineup/useLineupOptimizer.ts), der Verkaufsplan gegen ein negatives
 * Konto (src/utils/sellPlan.ts), die liga-eigenen Regeln (src/lineup/rules.ts)
 * und das Restprogramm (src/utils/fixtureDifficulty.ts). Eine Zeile, die mehr
 * verspricht, ist hier teurer als anderswo — sie steht am Anfang und wird
 * sofort geprüft.
 */
export function LandingScreen() {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.hero}>
          {/* Dekorativ — die Wortmarke daneben sagt dasselbe noch einmal. */}
          <img src="/icons/icon-192.png" alt="" width={72} height={72} className={styles.mark} />
          <h1 className={styles.title}>kickflow</h1>
          <p className={styles.claim}>Der Aufstellungs-Optimizer für deine Kickbase-Liga.</p>
          <p className={styles.lead}>
            Die beste Elf für den nächsten Spieltag — mit Restprogramm, mit den Verkäufen, die
            dein Konto ausgleichen, und mit den Regeln, die ihr in eurer Liga vereinbart habt.
          </p>

          <Link to="/login" className={styles.cta}>
            Mit Kickbase-Konto anmelden
          </Link>
          <p className={styles.ctaHint}>
            Kostenlos. Nichts zu installieren — kickflow läuft im Browser und lässt sich auf den
            Startbildschirm legen.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="landing-funktionen">
          <h2 id="landing-funktionen" className={styles.sectionTitle}>
            Was kickflow macht
          </h2>

          <ul className={styles.features}>
            <li className={styles.feature}>
              <h3 className={styles.featureTitle}>Beste Elf, jede Formation</h3>
              <p className={styles.featureBody}>
                Der Optimizer rechnet deinen Kader für jede Formation durch und zeigt, welche
                Elf am meisten bringt — und welche Wechsel dich von deiner aktuellen
                Aufstellung dorthin bringen.
              </p>
            </li>
            <li className={styles.feature}>
              <h3 className={styles.featureTitle}>Konto im Minus? Verkaufsplan.</h3>
              <p className={styles.featureBody}>
                kickflow sucht die Verkäufe, die dein Defizit decken und die Elf am wenigsten
                schwächen — statt dass du raten musst, wer gehen kann.
              </p>
            </li>
            <li className={styles.feature}>
              <h3 className={styles.featureTitle}>Eure Liga-Regeln</h3>
              <p className={styles.featureBody}>
                Höchstens zwei Spieler pro Verein? Der Optimizer hält sich daran, statt eine Elf
                vorzuschlagen, die in eurer Liga gar nicht zählt.
              </p>
            </li>
            <li className={styles.feature}>
              <h3 className={styles.featureTitle}>Restprogramm, Markt und Kader</h3>
              <p className={styles.featureBody}>
                Wie schwer die nächsten Gegner sind, fließt in die Empfehlung ein. Dazu Markt,
                Marktwerte, Kader der Mitspieler und die Tabelle deiner Liga.
              </p>
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="landing-daten">
          <h2 id="landing-daten" className={styles.sectionTitle}>
            Was mit deinen Daten passiert
          </h2>
          <p className={styles.sectionBody}>
            Für die Anmeldung braucht kickflow dein Kickbase-Konto — das ist eine Frage des
            Vertrauens, deshalb hier die Antwort, bevor du sie stellst.
          </p>
          <ul className={styles.facts}>
            <li className={styles.fact}>
              Die App spricht direkt aus deinem Browser mit der Kickbase-API. Es gibt keinen
              Server von kickflow dazwischen, der etwas sehen könnte.
            </li>
            <li className={styles.fact}>
              Deine Zugangsdaten und dein Zugriffstoken verlassen dieses Gerät ausschließlich in
              Richtung Kickbase.
            </li>
            <li className={styles.fact}>
              Kein Tracking, keine Analyse, keine Werbung — die App lädt von keiner anderen
              Stelle etwas nach.
            </li>
          </ul>
          {/*
           * Interner Link, seit die Erklärung eine eigene Route ist
           * (src/legal/, Begründung in src/support/links.ts). Für DIESE Seite
           * ist das mehr als Bequemlichkeit: sie wirbt damit, dass nichts
           * nachgeladen wird — ein Absprung auf eine fremde Domain direkt
           * unter dem Satz „die App lädt von keiner anderen Stelle etwas
           * nach" wäre genau der falsche Beweis.
           */}
          <Link
            to={PRIVACY_PATH}
            className={styles.privacyLink}
            state={withOrigin('/', 'Startseite').state}
          >
            Datenschutzerklärung lesen
          </Link>
        </section>

        <footer className={styles.footer}>
          <Link to="/login" className={styles.footerCta}>
            Zur Anmeldung
          </Link>
          <div className={styles.legal}>
            <ExternalLink url={HOMEPAGE_URL} label="Homepage" compact />
            <span className={styles.legalSeparator} aria-hidden="true">
              ·
            </span>
            {/*
             * Der Quellcode ist der Beleg für den Abschnitt darüber: kein
             * Server, kein Tracking, nichts Nachgeladenes. Das Label nennt
             * GitHub ausdrücklich — `ExternalLink` öffnet über `window.open`
             * und zeigt damit keine Ziel-URL, die es sonst verraten würde.
             */}
            <ExternalLink url={REPOSITORY_URL} label="Quellcode auf GitHub" compact />
            <span className={styles.legalSeparator} aria-hidden="true">
              ·
            </span>
            <Link
              to={PRIVACY_PATH}
              className={styles.legalLink}
              state={withOrigin('/', 'Startseite').state}
            >
              {PRIVACY_TITLE}
            </Link>
            <span className={styles.legalSeparator} aria-hidden="true">
              ·
            </span>
            <Link
              to={TERMS_PATH}
              className={styles.legalLink}
              state={withOrigin('/', 'Startseite').state}
            >
              {TERMS_TITLE}
            </Link>
          </div>
          <p className={styles.disclaimer}>
            Inoffizielle App. Nicht mit der Kickbase GmbH verbunden. Kickbase ist eine Marke der
            Kickbase GmbH.
          </p>
        </footer>
      </div>
    </div>
  );
}

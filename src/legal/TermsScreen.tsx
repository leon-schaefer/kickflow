import { Link, useLocation } from 'react-router';
import { ExternalLink } from '@/components/ExternalLink';
import { withOrigin } from '@/shell/useBackTarget';
import { HOMEPAGE_URL } from '@/support/links';
import { LegalPage } from './LegalPage';
import { PRIVACY_PATH, PRIVACY_TITLE, TERMS_TITLE } from './legalRoutes';
import styles from './LegalPage.module.css';

/**
 * Nutzungsbedingungen.
 *
 * Neu — es gab bisher keine. Was es gab, war der Disclaimer-Satz unter dem
 * Login und im Mehr-Tab („Inoffizielle App. Nicht mit der Kickbase GmbH
 * verbunden."). Der bleibt dort stehen, weil er an der Stelle gebraucht wird,
 * an der jemand seine Zugangsdaten eintippt; er trägt aber nur einen der
 * Punkte, die diese Seite klären muss.
 *
 * Der Text nennt bewusst die drei Dinge, die bei dieser App wirklich
 * schiefgehen können, statt eine Formularsammlung abzuschreiben:
 *
 *   1. Die App hängt an einer INOFFIZIELLEN Schnittstelle. Sie kann von einem
 *      Tag auf den anderen aufhören zu funktionieren, ohne dass hier etwas
 *      geändert wurde.
 *   2. Die Empfehlungen (Optimizer, Verkaufsvorschlag, Kaufempfehlung) sind
 *      Rechenergebnisse aus öffentlich sichtbaren Zahlen, keine Zusicherung.
 *      Wer danach Spieler verkauft, tut das auf eigene Rechnung.
 *   3. Die App handelt in einem fremden Account. Ein Gebot, das sie absendet,
 *      ist ein echtes Gebot bei Kickbase.
 *
 * INHALTLICHER VORBEHALT wie bei der Datenschutzerklärung: beschreibt
 * wahrheitsgemäß, was die App tut, und ist keine Rechtsberatung.
 */
export function TermsScreen() {
  const location = useLocation();

  return (
    <LegalPage title={TERMS_TITLE} updated="2026-09-07">
      <p className={styles.lead}>
        kickflow ist ein kostenloser, inoffizieller Begleiter für das Fantasy-Manager-Spiel
        Kickbase. Mit der Nutzung der App erkennst du die folgenden Bedingungen an.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Kein Zusammenhang mit der Kickbase GmbH</h2>
        <p className={styles.text}>
          kickflow ist ein privates Projekt und wird weder von der Kickbase GmbH betrieben noch
          von ihr unterstützt, geprüft oder freigegeben. Es besteht keine geschäftliche
          Verbindung. „Kickbase" ist eine Marke der Kickbase GmbH und wird hier ausschließlich
          benutzt, um zu beschreiben, worauf die App sich bezieht.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Was du brauchst</h2>
        <p className={styles.text}>
          Die Nutzung setzt einen eigenen, gültigen Kickbase-Account voraus. kickflow legt keine
          Accounts an und vergibt keine Zugänge. Für deinen Account gelten die Bedingungen der
          Kickbase GmbH — auch bei der Nutzung über kickflow. Halte deine Zugangsdaten geheim; gib
          keine fremden Zugangsdaten ein.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Inoffizielle Schnittstelle, keine Verfügbarkeit</h2>
        <p className={styles.text}>
          kickflow spricht mit einer nicht öffentlich dokumentierten Schnittstelle von Kickbase.
          Diese kann jederzeit und ohne Vorankündigung geändert, eingeschränkt oder abgeschaltet
          werden. Damit kann die App jederzeit ganz oder teilweise ausfallen, falsche Werte
          anzeigen oder eingestellt werden. Es gibt keine Zusage zu Verfügbarkeit, Aktualität,
          Fortbestand oder Weiterentwicklung, und kein Anspruch darauf.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Empfehlungen sind Rechenergebnisse</h2>
        <p className={styles.text}>
          Aufstellungs-Optimierung, Verkaufsvorschlag, Kaufempfehlung, Spielzeit-Kennzahlen und
          Gegner-Härte werden aus den Zahlen berechnet, die Kickbase liefert. Es sind
          Anhaltspunkte, keine Vorhersage und keine Anlage-, Finanz- oder Spielberatung. Ob du
          einer Empfehlung folgst, entscheidest du; die Folgen für Punkte, Kontostand und
          Ligaplatzierung trägst du.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Aktionen wirken echt</h2>
        <p className={styles.text}>
          Wo kickflow etwas absendet — Aufstellung speichern, Gebot abgeben, Gebot zurückziehen,
          Spieler auf den Markt stellen oder herunternehmen —, geschieht das unmittelbar in deinem
          Kickbase-Account und mit echter Wirkung im Spiel. Es gibt keinen Testmodus und kein
          Rückgängig durch kickflow. Prüfe eine Eingabe, bevor du sie bestätigst.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Haftung</h2>
        <p className={styles.text}>
          Die App wird kostenlos und wie besehen bereitgestellt. Die Haftung des Betreibers
          richtet sich nach den gesetzlichen Vorschriften: Für Vorsatz und grobe Fahrlässigkeit
          sowie bei Verletzung von Leben, Körper oder Gesundheit wird unbeschränkt gehaftet. Bei
          einfacher Fahrlässigkeit wird nur für die Verletzung wesentlicher Vertragspflichten und
          nur für den vorhersehbaren, vertragstypischen Schaden gehaftet. Eine weitergehende
          Haftung ist ausgeschlossen. Gesetzliche Rechte, die sich nicht wirksam ausschließen
          lassen, bleiben unberührt.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Nutzung der App</h2>
        <p className={styles.text}>Nicht erlaubt ist insbesondere:</p>
        <ul className={styles.list}>
          <li>
            die App oder die dahinterliegende Schnittstelle automatisiert in einer Weise
            abzufragen, die über die normale Bedienung hinausgeht;
          </li>
          <li>zu versuchen, sich Zugang zu fremden Accounts oder Daten zu verschaffen;</li>
          <li>
            Schutzmechanismen zu umgehen oder die App so zu verändern, dass sie sich als
            offizielles Kickbase-Angebot darstellt.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>8. Freiwillige Unterstützung</h2>
        <p className={styles.text}>
          Wenn im Mehr-Tab ein Unterstützen-Button erscheint, führt er auf eine externe
          Spendenseite. Eine Zahlung dort ist freiwillig, erwirbt keine Leistung, keinen
          Funktionsumfang und keinen Anspruch auf Support, und wird nicht zurückerstattet. Für die
          Abwicklung gelten die Bedingungen des jeweiligen Anbieters.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>9. Änderungen und anwendbares Recht</h2>
        <p className={styles.text}>
          Diese Bedingungen können angepasst werden, wenn sich die App ändert; der Stand am Ende
          der Seite nennt die aktuelle Fassung. Es gilt deutsches Recht. Ist eine Bestimmung
          unwirksam, bleiben die übrigen wirksam.
        </p>
        <ExternalLink url={HOMEPAGE_URL} label="Impressum und Kontakt (codewithleon.dev)" />
        <Link
          to={PRIVACY_PATH}
          className={styles.crossLink}
          state={withOrigin(location.pathname, TERMS_TITLE).state}
        >
          {PRIVACY_TITLE} lesen
        </Link>
      </section>
    </LegalPage>
  );
}

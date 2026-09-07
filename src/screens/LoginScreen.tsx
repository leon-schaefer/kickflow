import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import {
  blockedForSeconds,
  recordFailure,
  recordSuccess,
} from '@/auth/loginThrottle';
import { hasErrors, validateCredentials, type LoginFieldErrors } from '@/auth/loginValidation';
import { ExternalLink } from '@/components/ExternalLink';
import { Spinner } from '@/components/Spinner';
import { TextField } from '@/components/TextField';
import {
  PRIVACY_PATH,
  PRIVACY_TITLE,
  TERMS_PATH,
  TERMS_TITLE,
} from '@/legal/legalRoutes';
import { withOrigin } from '@/shell/useBackTarget';
import { HOMEPAGE_URL } from '@/support/links';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './LoginScreen.module.css';

/**
 * Ein echtes `<form>` und nicht mehr zwei Felder plus Button: das bringt die
 * Absenden-Taste der iOS-Tastatur (vorher `onSubmitEditing` am Passwortfeld)
 * und Passwortmanager mit.
 *
 * Das `preventDefault` ist dabei nicht Stil, sondern Pflicht: ohne es
 * navigiert der Browser das Formular ab, und die CSP in vercel.json hat
 * `form-action 'none'` — der Absendevorgang würde blockiert und der Login
 * schlüge ohne sichtbaren Grund fehl.
 */
export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  /** > 0 = gesperrt, siehe src/auth/loginThrottle.ts. */
  const [blockedSeconds, setBlockedSeconds] = useState(() => blockedForSeconds());

  // Feste IDs für aria-describedby. `useId` statt Literale, weil der Screen
  // theoretisch zweimal im Baum stehen könnte und doppelte IDs die Zuordnung
  // Feld↔Fehlermeldung zerstören.
  const emailErrorId = useId();
  const passwordErrorId = useId();

  /**
   * Zählt die Sperre herunter, solange eine läuft.
   *
   * Der Countdown muss sichtbar sein: ein Knopf, der ohne Erklärung nicht
   * reagiert, ist von einem kaputten Knopf nicht zu unterscheiden. Das
   * Intervall läuft nur während einer Sperre und räumt sich selbst auf.
   */
  useEffect(() => {
    if (blockedSeconds <= 0) return;
    const timer = setInterval(() => setBlockedSeconds(blockedForSeconds()), 500);
    return () => clearInterval(timer);
  }, [blockedSeconds]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Erst die Sperre: sonst zählt ein Versuch während der Wartezeit als
    // weiterer Fehlversuch und verlängert sie.
    const remaining = blockedForSeconds();
    if (remaining > 0) {
      setBlockedSeconds(remaining);
      return;
    }

    // Dann die Eingaben. Eine Anfrage, die ohnehin scheitern muss, wird nicht
    // gestellt — sie würde sonst als Fehlversuch zählen und eine fremde API
    // belasten.
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError(null);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      recordSuccess();
      navigate('/leagues', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
      setBlockedSeconds(recordFailure());
    } finally {
      setLoading(false);
    }
  }

  /**
   * Beim Tippen NUR den Fehler des bearbeiteten Feldes löschen.
   *
   * Geprüft wird beim Absenden und nicht bei jedem Tastendruck: eine
   * E-Mail-Adresse ist während der Eingabe fast immer unvollständig, und ein
   * Formular, das einen anmeckert, bevor man fertig ist, ist die häufigste
   * Form von schlechter Validierung. Der Fehler verschwindet aber sofort, wenn
   * man ihn anfasst — er soll nicht stehen bleiben, während man ihn behebt.
   */
  function editEmail(value: string) {
    setEmail(value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  }

  function editPassword(value: string) {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  }

  /*
   * Der Knopf bleibt aktiv, solange nichts lädt und keine Sperre läuft — auch
   * bei leeren Feldern.
   *
   * Vorher war er bei leeren Feldern deaktiviert. Das sieht zuvorkommend aus,
   * ist aber schlechter: ein deaktivierter Absende-Knopf sagt nicht, WAS
   * fehlt, er ist für Screenreader kommentarlos nicht bedienbar, und er
   * verschluckt genau die Geste, mit der man sich sagen lässt, was noch fehlt.
   * Jetzt führt Drücken zu den Meldungen an den Feldern.
   */
  const canSubmit = !loading && blockedSeconds === 0;

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Kickflow</h1>
      <p className={styles.subtitle}>Mit deinem Kickbase-Konto anmelden</p>

      {/*
       * `noValidate` schaltet die EIGENE Prüfung des Browsers ab, und das ist
       * nötig, damit die Prüfung in src/auth/loginValidation.ts überhaupt zum
       * Zug kommt: das E-Mail-Feld ist `type="email"`, und ein Browser
       * verweigert bei ungültigem Wert das Absenden, bevor `onSubmit` läuft.
       * Die eigene Meldung erschien damit nie — genau das hat der Test
       * „benennt einen Tippfehler in der Adresse" aufgedeckt.
       *
       * Und selbst wenn sie erschiene, wäre die Browser-Blase die schlechtere
       * Meldung: sie lässt sich nicht gestalten, verschwindet nach wenigen
       * Sekunden, spricht die Sprache des BROWSERS statt der der App, und sie
       * lässt sich nicht über `aria-describedby` mit dem Feld verbinden.
       *
       * `type="email"` bleibt trotzdem stehen — es bringt auf dem Handy die
       * richtige Tastatur, und darum geht es dort.
       */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <TextField
            type="email"
            placeholder="E-Mail"
            aria-label="E-Mail"
            autoCapitalize="none"
            autoComplete="email"
            // `inputMode` bringt auf dem Handy die Tastatur mit @ und Punkt.
            inputMode="email"
            value={email}
            onChange={editEmail}
            clearLabel="E-Mail löschen"
            /*
             * `aria-invalid` und `aria-describedby` sind das, was die Meldung
             * für einen Screenreader mit dem FELD verbindet. Ohne sie steht
             * unter dem Formular roter Text, der zu irgendetwas gehört —
             * sichtbar zuordenbar über die Position, vorlesbar nicht.
             */
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          />
          {fieldErrors.email && (
            <p id={emailErrorId} className={styles.fieldError}>
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <TextField
            type="password"
            placeholder="Passwort"
            aria-label="Passwort"
            autoComplete="current-password"
            value={password}
            onChange={editPassword}
            clearLabel="Passwort löschen"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
          />
          {fieldErrors.password && (
            <p id={passwordErrorId} className={styles.fieldError}>
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Live-Region: die Meldung erscheint erst nach dem Absenden. */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {/*
         * Die Sperre nach mehreren Fehlversuchen (src/auth/loginThrottle.ts).
         * `role="status"` und nicht `role="alert"`: der Countdown aktualisiert
         * sich zweimal je Sekunde, und `alert` würde jede Änderung
         * unterbrechend vorlesen. `aria-live="polite"` steckt in `status`
         * schon drin; die Sekunden stehen zusätzlich im Knopftext, damit die
         * Auskunft auch dort ist, wo man drückt.
         */}
        {blockedSeconds > 0 && (
          <p className={styles.error} role="status">
            Zu viele Fehlversuche. Bitte {blockedSeconds}{' '}
            {blockedSeconds === 1 ? 'Sekunde' : 'Sekunden'} warten.
          </p>
        )}

        <button
          type="submit"
          className={cx(layout.pressableH, styles.button)}
          disabled={!canSubmit}
        >
          {loading ? (
            <Spinner color="currentColor" />
          ) : blockedSeconds > 0 ? (
            `Anmelden (${blockedSeconds} s)`
          ) : (
            'Anmelden'
          )}
        </button>
      </form>

      <p className={styles.hint}>
        Kickflow spricht direkt mit der Kickbase-API. Deine Zugangsdaten und dein Zugriffstoken
        verlassen dieses Gerät ausschließlich in Richtung Kickbase.
      </p>

      {/*
       * Vor dem Login ist der Mehr-Tab unerreichbar — hier ist die einzige
       * Stelle, an der jemand Datenschutz und Bedingungen lesen kann, bevor
       * er seine Kickbase-Zugangsdaten eintippt. Genau deshalb liegen die
       * beiden Routen außerhalb von `RequireAuth` (siehe routes.tsx).
       *
       * `<Link>` und nicht `<ExternalLink>`: seit die Seiten in der App
       * liegen, ist ein neuer Tab genau das Falsche — er reißt aus dem Login
       * heraus, und die eingetippte E-Mail wäre beim Zurückkommen weg. Der
       * `withOrigin`-State sorgt dafür, dass „Zurück" auf dem Login landet
       * und nicht in der Ligenliste.
       *
       * Die Homepage bleibt extern: die liegt wirklich woanders.
       */}
      <div className={styles.legal}>
        <ExternalLink url={HOMEPAGE_URL} label="Homepage" compact />
        <span className={styles.legalSeparator} aria-hidden="true">
          ·
        </span>
        <Link
          to={PRIVACY_PATH}
          className={styles.legalLink}
          state={withOrigin('/login', 'Anmelden').state}
        >
          {PRIVACY_TITLE}
        </Link>
        <span className={styles.legalSeparator} aria-hidden="true">
          ·
        </span>
        <Link
          to={TERMS_PATH}
          className={styles.legalLink}
          state={withOrigin('/login', 'Anmelden').state}
        >
          {TERMS_TITLE}
        </Link>
      </div>

      <p className={styles.disclaimer}>
        Inoffizielle App. Nicht mit der Kickbase GmbH verbunden. Kickbase ist eine Marke der
        Kickbase GmbH.
      </p>
    </div>
  );
}

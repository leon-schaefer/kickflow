import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { ExternalLink } from '@/components/ExternalLink';
import { Spinner } from '@/components/Spinner';
import { TextField } from '@/components/TextField';
import { HOMEPAGE_URL, PRIVACY_URL } from '@/support/links';
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/leagues', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Kickflow</h1>
      <p className={styles.subtitle}>Mit deinem Kickbase-Konto anmelden</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          type="email"
          placeholder="E-Mail"
          aria-label="E-Mail"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          clearLabel="E-Mail löschen"
        />
        <TextField
          type="password"
          placeholder="Passwort"
          aria-label="Passwort"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          clearLabel="Passwort löschen"
        />

        {/* Live-Region: die Meldung erscheint erst nach dem Absenden. */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={cx(layout.pressableH, styles.button)}
          disabled={!canSubmit}
        >
          {loading ? <Spinner color="currentColor" /> : 'Anmelden'}
        </button>
      </form>

      <p className={styles.hint}>
        Kickflow spricht direkt mit der Kickbase-API. Deine Zugangsdaten und dein Zugriffstoken
        verlassen dieses Gerät ausschließlich in Richtung Kickbase.
      </p>

      {/*
       * Vor dem Login ist der Mehr-Tab unerreichbar — hier ist die einzige
       * Stelle, an der jemand den Datenschutz-Hinweis lesen kann, bevor er
       * seine Kickbase-Zugangsdaten eintippt.
       */}
      <div className={styles.legal}>
        <ExternalLink url={HOMEPAGE_URL} label="Homepage" compact />
        <span className={styles.legalSeparator} aria-hidden="true">
          ·
        </span>
        <ExternalLink url={PRIVACY_URL} label="Datenschutz" compact />
      </div>

      <p className={styles.disclaimer}>
        Inoffizielle App. Nicht mit der Kickbase GmbH verbunden. Kickbase ist eine Marke der
        Kickbase GmbH.
      </p>
    </div>
  );
}

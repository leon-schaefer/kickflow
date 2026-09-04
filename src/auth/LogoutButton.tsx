import { useEffect, useState } from 'react';
import { Spinner } from '@/components/Spinner';
import { cx } from '@/utils/cx';
import { useAuth } from './AuthProvider';
import styles from './LogoutButton.module.css';

/** Nach dieser Zeit fällt ein scharfgestellter Button in den Normalzustand zurück. */
const CONFIRM_TIMEOUT_MS = 4000;

interface LogoutButtonProps {
  /** Kompakt = Textbutton für den Header der Ligenliste, sonst volle Kartenzeile. */
  compact?: boolean;
}

/**
 * Abmelden in zwei Stufen: der erste Tap stellt scharf, der zweite meldet ab.
 *
 * Die Zweistufigkeit entstand als Ersatz für `Alert.alert`, das
 * react-native-web als leere Methode implementierte. Dieser Grund ist mit dem
 * Umzug weg — der Mechanismus bleibt trotzdem, und zwar aus einem eigenen: die
 * Alternative im Browser wäre `window.confirm`, ein blockierender Systemdialog,
 * der in einer installierten PWA fremd aussieht und sich nicht gestalten lässt.
 * Zwei Taps auf denselben Button brauchen kein Modal und lesen sich überall
 * gleich.
 *
 * Nach dem Abmelden wird bewusst nicht navigiert: `logout()` setzt den Token
 * auf null, woraufhin src/routes/RequireAuth.tsx auf /login umleitet und
 * diesen Button ohnehin abbaut.
 */
export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const { logout } = useAuth();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  async function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await logout();
    } catch {
      // Ohne Reset bliebe der Button dauerhaft im Ladezustand hängen.
      setBusy(false);
      setArmed(false);
    }
  }

  const label = armed ? 'Wirklich abmelden?' : 'Abmelden';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={label}
      // Der scharfgestellte Zustand ist echter Zustand, nicht nur Aussehen —
      // deshalb ein Attribut und keine zweite Klasse.
      data-armed={armed ? 'true' : undefined}
      className={cx(compact ? styles.compact : styles.full)}
    >
      {busy ? <Spinner size={16} color="var(--color-danger)" /> : label}
    </button>
  );
}

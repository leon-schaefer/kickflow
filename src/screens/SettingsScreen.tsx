import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { useBackTarget } from '@/shell/useBackTarget';
import { AppHeader } from '@/shell/AppHeader';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './SettingsScreen.module.css';

/**
 * Einstellungen: der Logout. Erreichbar über den Fuß des LeagueSwitchers.
 *
 * Hier standen bis zum Web-only-Umbau auch die Benachrichtigungs-Schalter
 * (Aufstellungs-Deadline, ablaufendes Gebot). Die liefen über
 * expo-notifications und damit ausschließlich nativ — im Browser zeigte der
 * Screen an dieser Stelle nur "Auf Web/PWA nicht verfügbar". Ein Ersatz über
 * Web Push bräuchte einen eigenen Server, den kickflow nicht hat.
 */
export function SettingsScreen() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  // Der Screen liegt außerhalb einer Liga; ohne Herkunft im state führt
  // Zurück deshalb auf die Ligenliste statt auf einen Liga-Tab.
  const back = useBackTarget('');

  async function handleLogout() {
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
        </div>
      </div>
    </>
  );
}

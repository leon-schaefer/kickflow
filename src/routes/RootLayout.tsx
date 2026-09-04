import { Outlet } from 'react-router';
import styles from './RootLayout.module.css';

/**
 * Äußere Hülle aller Screens.
 *
 * Hält die App auf Viewport-Höhe und begrenzt die Inhaltsbreite — das
 * Äquivalent zum `GestureHandlerRootView` mit `flex: 1` plus
 * `contentStyle`/`sceneStyle` aus stackScreenOptions.
 *
 * `position: relative` ist Absicht und kein Beiwerk: der UpdateBanner ist
 * `position: absolute` und braucht einen positionierten Vorfahren. Unter
 * React Native positionierte ihn der nächste View-Parent automatisch.
 */
export function RootLayout() {
  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  );
}

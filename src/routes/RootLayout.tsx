import { Outlet } from 'react-router';
import { UpdateBanner } from '@/components/UpdateBanner';
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
 *
 * Der UpdateBanner hängt hier und nicht in einem der Tab-Layouts, weil er
 * jede Route überlagern soll — auch Login und Liga-Auswahl, die außerhalb
 * der Tabs liegen. Er rendert `null`, solange kein Deploy erkannt wurde,
 * kostet also nichts. Beim Umzug auf DOM war er eine Zeit lang gar nicht
 * gemountet: die ganze Kette (build-id.txt, register-sw.js, Event) lief,
 * nur sah sie niemand. `RootLayout.test.tsx` hält das jetzt fest.
 */
export function RootLayout() {
  return (
    <div className={styles.shell}>
      <UpdateBanner />
      <Outlet />
    </div>
  );
}

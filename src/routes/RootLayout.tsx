import { Outlet } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { UpdateBanner } from '@/components/UpdateBanner';
import { InstallHint } from '@/pwa/InstallHint';
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
 * `useDocumentTitle` hängt aus demselben Grund hier wie der Banner: er soll
 * für JEDE Route gelten, auch für Login und Liga-Auswahl außerhalb der Tabs.
 * Den Titel selbst trägt die Route (`handle.title` in routes.tsx).
 *
 * Der UpdateBanner hängt hier und nicht in einem der Tab-Layouts, weil er
 * jede Route überlagern soll — auch Login und Liga-Auswahl, die außerhalb
 * der Tabs liegen. Er rendert `null`, solange kein Deploy erkannt wurde,
 * kostet also nichts. Beim Umzug auf DOM war er eine Zeit lang gar nicht
 * gemountet: die ganze Kette (build-id.txt, register-sw.js, Event) lief,
 * nur sah sie niemand. `RootLayout.test.tsx` hält das jetzt fest.
 */
export function RootLayout() {
  useDocumentTitle();

  return (
    <div className={styles.shell}>
      <UpdateBanner />
      {/*
       * Wie der Banner hier und nicht in einem Tab-Layout: der Hinweis
       * erscheint direkt nach dem Login, und der Ligen-Picker liegt außerhalb
       * der Tabs. Er rendert `null`, solange niemand angemeldet ist oder der
       * Merker steht (src/pwa/), kostet also nichts.
       */}
      <InstallHint />
      <Outlet />
    </div>
  );
}

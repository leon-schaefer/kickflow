import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { Spinner } from '@/components/Spinner';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { PRIVACY_PATH, PRIVACY_TITLE, TERMS_PATH, TERMS_TITLE } from '@/legal/legalRoutes';
import { LoginScreen } from '@/screens/LoginScreen';
import { IndexRedirect } from './IndexRedirect';
import { LeagueLayout } from './LeagueLayout';
import { NotFound } from './NotFound';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';
import { TabsLayout } from './TabsLayout';
import styles from './routes.module.css';

/**
 * Der Route-Baum — Ersatz für das Dateisystem-Routing von expo-router.
 *
 * Die 13 URLs bleiben unverändert: PWA-Installationen und Lesezeichen zeigen
 * darauf, und der Catch-All-Rewrite in vercel.json liefert jeden Pfad an
 * diese SPA. Neu dazu kommen `/datenschutz` und `/nutzungsbedingungen`.
 *
 * Pathless Layout-Routen (Kind-Array ohne eigenen `path`) sind das exakte
 * Äquivalent zu expo-routers Klammer-Gruppen: `RequireAuth` entspricht
 * `(app)`, `TabsLayout` entspricht `(tabs)` — beide gruppieren und legen ein
 * Layout darüber, ohne in der URL zu erscheinen.
 *
 * Als Array exportiert und nicht als fertiger Router, damit Tests denselben
 * Baum mit `createMemoryRouter` mounten können, ohne einen Browser.
 *
 * ## Warum die Screens `lazy` sind
 *
 * Vorher lag die ganze App in EINEM Chunk: 581,72 kB (175,56 kB gzip). Wer
 * den Login sah, hatte den Markt-Tab, den Optimizer, die Charts und jeden
 * Detail-Screen schon geladen — auf dem Handy vor dem ersten Tippen.
 *
 * `lazy()` schneidet den Baum an den Route-Grenzen; jeder Screen wird ein
 * eigener Chunk, den Rolldown erst beim Betreten lädt. Zwei Ausnahmen stehen
 * bewusst statisch oben:
 *
 *   - `LoginScreen` — der erste Screen für jeden Nicht-Angemeldeten. Ihn
 *     nachzuladen hieße, den kritischen Pfad um eine zweite Rundreise zu
 *     verlängern, also genau das Gegenteil.
 *   - Die Layouts (`RootLayout`, `RequireAuth`, `TabsLayout`, `LeagueLayout`)
 *     und `NotFound` — die stecken in jedem Pfad bzw. sind winzig, ein
 *     eigener Chunk kostete mehr Anfrage als er Bytes spart.
 *
 * Die Screens tragen `default`-Exporte NICHT; `lazy` erwartet aber genau das.
 * Deshalb der `.then`-Umweg pro Import, statt in 13 Dateien den Export-Stil
 * zu ändern — die Named Exports sind überall sonst importiert (Tests
 * eingeschlossen) und sollen so bleiben.
 *
 * ## `handle.title`
 *
 * Jede Route, die eine Seite IST (kein Layout, keine Weiterleitung), trägt
 * ihren Titel im `handle`. `useDocumentTitle` in RootLayout liest sie über
 * `useMatches()` und setzt daraus `document.title` — siehe
 * src/app/documentTitle.ts.
 *
 * Der Titel steht deshalb HIER und nicht im Screen: so ist er eine
 * Eigenschaft des Baums, und eine neue Route ohne Titel fällt beim Lesen
 * dieser Datei auf. Verteilt über 15 `useEffect`s wäre er 15 Stellen, an
 * denen er fehlen kann.
 *
 * Die Tab-Titel kommen aus `leagueTabTitles`, damit Kopfzeile, Tab-Leiste
 * und Fenstertitel dieselben Wörter benutzen; die Rechtsseiten aus
 * legalRoutes.ts, aus demselben Grund.
 */

/** `lazy()` braucht `{ default: Component }`, die Screens exportieren benannt. */
const LeaguesScreen = lazy(() =>
  import('@/screens/LeaguesScreen').then((m) => ({ default: m.LeaguesScreen })),
);
const SettingsScreen = lazy(() =>
  import('@/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);
const LineupScreen = lazy(() =>
  import('@/screens/LineupScreen').then((m) => ({ default: m.LineupScreen })),
);
const PlayersScreen = lazy(() =>
  import('@/screens/PlayersScreen').then((m) => ({ default: m.PlayersScreen })),
);
const MarketScreen = lazy(() =>
  import('@/screens/MarketScreen').then((m) => ({ default: m.MarketScreen })),
);
const LeagueScreen = lazy(() =>
  import('@/screens/LeagueScreen').then((m) => ({ default: m.LeagueScreen })),
);
const MoreScreen = lazy(() =>
  import('@/screens/MoreScreen').then((m) => ({ default: m.MoreScreen })),
);
const PlayerDetailScreen = lazy(() =>
  import('@/screens/PlayerDetailScreen').then((m) => ({ default: m.PlayerDetailScreen })),
);
const ManagerDetailScreen = lazy(() =>
  import('@/screens/ManagerDetailScreen').then((m) => ({ default: m.ManagerDetailScreen })),
);
const RulesScreen = lazy(() =>
  import('@/screens/RulesScreen').then((m) => ({ default: m.RulesScreen })),
);
const FixturesScreen = lazy(() =>
  import('@/screens/FixturesScreen').then((m) => ({ default: m.FixturesScreen })),
);
const PrivacyScreen = lazy(() =>
  import('@/legal/PrivacyScreen').then((m) => ({ default: m.PrivacyScreen })),
);
const TermsScreen = lazy(() =>
  import('@/legal/TermsScreen').then((m) => ({ default: m.TermsScreen })),
);

/**
 * Platzhalter, während ein Screen-Chunk lädt.
 *
 * Bewusst nur der Spinner und keine Skeleton-Nachbildung des Screens: der
 * Chunk ist einige Kilobyte groß und beim zweiten Aufruf im Service-Worker-
 * Cache (public/sw.js behandelt `/assets/` cache-first) — sichtbar ist das
 * hier meist nur beim allerersten Betreten.
 *
 * `role="status"` statt eines stummen Spinners: sonst ist der Wechsel für
 * einen Screenreader ein leerer Bildschirm ohne Ansage.
 */
function ScreenFallback() {
  return (
    <div className={styles.fallback} role="status" aria-label="Wird geladen">
      <Spinner />
    </div>
  );
}

/**
 * Ein `<Suspense>` PRO Screen und nicht eines um den ganzen Baum.
 *
 * Der Unterschied ist sichtbar: läge die Grenze außen, würde beim Wechsel
 * eines Tabs auch Kopfzeile und Tab-Leiste durch den Platzhalter ersetzt —
 * der Rahmen der App würde flackern. So bleibt das Layout stehen und nur die
 * Fläche des Screens zeigt den Spinner.
 */
function screen(element: ReactNode): ReactNode {
  return <Suspense fallback={<ScreenFallback />}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      { path: 'login', element: <LoginScreen />, handle: { title: 'Anmelden' } },

      /*
       * ÖFFENTLICH, also außerhalb von `RequireAuth` — und das ist die
       * eigentliche Anforderung, nicht eine Bequemlichkeit: die
       * Datenschutzerklärung muss lesbar sein, BEVOR jemand seine
       * Kickbase-Zugangsdaten eintippt. Hinter dem Auth-Gate käme sie zu
       * spät, und der Login-Fuß könnte nicht darauf verlinken.
       *
       * Es sind zugleich die einzigen App-Routen, die in der sitemap.xml
       * stehen und die robots.txt nicht sperrt — alles andere braucht ein
       * Kickbase-Konto und hat für einen Crawler keinen Inhalt.
       */
      { path: PRIVACY_PATH.slice(1), element: screen(<PrivacyScreen />), handle: { title: PRIVACY_TITLE } },
      { path: TERMS_PATH.slice(1), element: screen(<TermsScreen />), handle: { title: TERMS_TITLE } },

      {
        // = Klammer-Gruppe `(app)`: das Auth-Gate, ohne URL-Segment.
        element: <RequireAuth />,
        children: [
          { path: 'leagues', element: screen(<LeaguesScreen />), handle: { title: 'Meine Ligen' } },
          { path: 'settings', element: screen(<SettingsScreen />), handle: { title: 'Einstellungen' } },

          {
            path: ':leagueId',
            element: <LeagueLayout />,
            children: [
              /*
               * NEU gegenüber Expo: dort hatte `(tabs)` keinen Index, `/:leagueId`
               * allein matchte also keinen Screen und ein Deep Link dorthin lief
               * ins Leere. Jeder Einstieg in eine Liga zeigt ohnehin auf `lineup`.
               */
              { index: true, element: <Navigate to="lineup" replace /> },

              {
                // = Klammer-Gruppe `(tabs)`: Rahmen mit Tab-Leiste, ohne URL-Segment.
                element: <TabsLayout />,
                children: [
                  { path: 'lineup', element: screen(<LineupScreen />), handle: { title: leagueTabTitles.lineup } },
                  { path: 'players', element: screen(<PlayersScreen />), handle: { title: leagueTabTitles.players } },
                  { path: 'market', element: screen(<MarketScreen />), handle: { title: leagueTabTitles.market } },
                  { path: 'league', element: screen(<LeagueScreen />), handle: { title: leagueTabTitles.league } },
                  { path: 'more', element: screen(<MoreScreen />), handle: { title: leagueTabTitles.more } },
                ],
              },

              // Über den Tabs: eigener Header mit Zurück, keine Tab-Leiste.
              { path: 'player/:playerId', element: screen(<PlayerDetailScreen />), handle: { title: 'Spieler' } },
              { path: 'manager/:managerId', element: screen(<ManagerDetailScreen />), handle: { title: 'Manager' } },
              { path: 'rules', element: screen(<RulesScreen />), handle: { title: 'Regeln' } },
              { path: 'fixtures', element: screen(<FixturesScreen />), handle: { title: 'Restprogramm' } },
            ],
          },
        ],
      },

      { path: '*', element: <NotFound />, handle: { title: 'Nicht gefunden' } },
    ],
  },
];

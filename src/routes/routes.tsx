import { Navigate, type RouteObject, useParams } from 'react-router';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { useBackTarget } from '@/shell/useBackTarget';
import { IndexRedirect } from './IndexRedirect';
import { LeagueLayout } from './LeagueLayout';
import { NotFound } from './NotFound';
import { Placeholder } from './Placeholder';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';
import { FixturesScreen } from '@/screens/FixturesScreen';
import { LeaguesScreen } from '@/screens/LeaguesScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { MarketScreen } from '@/screens/MarketScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { PlayersScreen } from '@/screens/PlayersScreen';
import { RulesScreen } from '@/screens/RulesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TabsLayout } from './TabsLayout';

/**
 * Der Route-Baum — Ersatz für das Dateisystem-Routing von expo-router.
 *
 * Die 13 URLs bleiben unverändert: PWA-Installationen und Lesezeichen zeigen
 * darauf, und der Catch-All-Rewrite in vercel.json liefert jeden Pfad an
 * diese SPA.
 *
 * Pathless Layout-Routen (Kind-Array ohne eigenen `path`) sind das exakte
 * Äquivalent zu expo-routers Klammer-Gruppen: `RequireAuth` entspricht
 * `(app)`, `TabsLayout` entspricht `(tabs)` — beide gruppieren und legen ein
 * Layout darüber, ohne in der URL zu erscheinen.
 *
 * Als Array exportiert und nicht als fertiger Router, damit Tests denselben
 * Baum mit `createMemoryRouter` mounten können, ohne einen Browser.
 */

/** Übergangsweise: Detail-Screens brauchen ihr Zurück-Ziel aus der Herkunft. */
function DetailPlaceholder({ name }: { name: string }) {
  const { leagueId } = useParams<{ leagueId: string }>();
  const back = useBackTarget(leagueId ?? '');
  return <Placeholder name={name} back={back} />;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      { path: 'login', element: <LoginScreen /> },

      {
        // = Klammer-Gruppe `(app)`: das Auth-Gate, ohne URL-Segment.
        element: <RequireAuth />,
        children: [
          { path: 'leagues', element: <LeaguesScreen /> },
          { path: 'settings', element: <SettingsScreen /> },

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
                  { path: 'lineup', element: <Placeholder name={leagueTabTitles.lineup} /> },
                  { path: 'players', element: <PlayersScreen /> },
                  { path: 'market', element: <MarketScreen /> },
                  { path: 'league', element: <Placeholder name={leagueTabTitles.league} /> },
                  { path: 'more', element: <MoreScreen /> },
                ],
              },

              // Über den Tabs: eigener Header mit Zurück, keine Tab-Leiste.
              { path: 'player/:playerId', element: <DetailPlaceholder name="Spieler" /> },
              { path: 'manager/:managerId', element: <DetailPlaceholder name="Manager" /> },
              { path: 'rules', element: <RulesScreen /> },
              { path: 'fixtures', element: <FixturesScreen /> },
            ],
          },
        ],
      },

      { path: '*', element: <NotFound /> },
    ],
  },
];

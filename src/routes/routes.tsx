import { Navigate, type RouteObject } from 'react-router';
import { FeedbackScreen } from '@/screens/FeedbackScreen';
import { FixturesScreen } from '@/screens/FixturesScreen';
import { LeagueScreen } from '@/screens/LeagueScreen';
import { LeaguesScreen } from '@/screens/LeaguesScreen';
import { LineupScreen } from '@/screens/LineupScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { ManagerDetailScreen } from '@/screens/ManagerDetailScreen';
import { MarketScreen } from '@/screens/MarketScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { PlayerDetailScreen } from '@/screens/PlayerDetailScreen';
import { PlayersScreen } from '@/screens/PlayersScreen';
import { RulesScreen } from '@/screens/RulesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { IndexRedirect } from './IndexRedirect';
import { LeagueLayout } from './LeagueLayout';
import { NotFound } from './NotFound';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';
import { TabsLayout } from './TabsLayout';

/**
 * Der Route-Baum — Ersatz für das Dateisystem-Routing von expo-router.
 *
 * Die 13 URLs aus der Expo-Zeit bleiben unverändert: PWA-Installationen und
 * Lesezeichen zeigen darauf, und der Catch-All-Rewrite in vercel.json liefert
 * jeden Pfad an diese SPA. Hinzugekommen ist seither `/feedback`.
 *
 * Pathless Layout-Routen (Kind-Array ohne eigenen `path`) sind das exakte
 * Äquivalent zu expo-routers Klammer-Gruppen: `RequireAuth` entspricht
 * `(app)`, `TabsLayout` entspricht `(tabs)` — beide gruppieren und legen ein
 * Layout darüber, ohne in der URL zu erscheinen.
 *
 * Als Array exportiert und nicht als fertiger Router, damit Tests denselben
 * Baum mit `createMemoryRouter` mounten können, ohne einen Browser.
 */

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
          /*
           * Feedback gehört zur App und nicht zu einer Liga — deshalb neben
           * den Einstellungen und nicht unter `:leagueId`, obwohl der
           * Einstieg im Mehr-Tab sitzt. Die einzige Route, die es unter
           * expo-router noch nicht gab.
           */
          { path: 'feedback', element: <FeedbackScreen /> },

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
                  { path: 'lineup', element: <LineupScreen /> },
                  { path: 'players', element: <PlayersScreen /> },
                  { path: 'market', element: <MarketScreen /> },
                  { path: 'league', element: <LeagueScreen /> },
                  { path: 'more', element: <MoreScreen /> },
                ],
              },

              // Über den Tabs: eigener Header mit Zurück, keine Tab-Leiste.
              { path: 'player/:playerId', element: <PlayerDetailScreen /> },
              { path: 'manager/:managerId', element: <ManagerDetailScreen /> },
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

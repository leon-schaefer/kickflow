import { Outlet, useParams } from 'react-router';
import { TabBar } from '@/shell/TabBar';
import styles from './TabsLayout.module.css';

/**
 * Rahmen der fünf Liga-Tabs — Ersatz für die Klammer-Gruppe `(tabs)`.
 *
 * Als pathless Layout-Route eingehängt, damit die Gruppe wie bei expo-router
 * nicht in der URL auftaucht: die Tabs bleiben `/:leagueId/lineup` usw.
 *
 * Der Header liegt bewusst NICHT hier, sondern in den einzelnen Tabs: vier von
 * fünf tragen den LeagueSwitcher als Titel, der Mehr-Tab dagegen den festen
 * Text „Mehr", weil dort nichts liga-spezifisch ist. Ein gemeinsamer Header
 * müsste diese Ausnahme selbst kennen.
 */
export function TabsLayout() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div className={styles.frame}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <TabBar leagueId={leagueId ?? ''} />
    </div>
  );
}

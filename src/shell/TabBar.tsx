import { NavLink } from 'react-router';
import { LeagueIcon } from '@/components/icons/LeagueIcon';
import { MoreIcon } from '@/components/icons/MoreIcon';
import { PitchIcon } from '@/components/icons/PitchIcon';
import { SquadIcon } from '@/components/icons/SquadIcon';
import { TrendIcon } from '@/components/icons/TrendIcon';
import { type LeagueTabName, leagueTabTitles } from '@/leagues/leagueTabs';
import styles from './TabBar.module.css';

/**
 * Untere Tab-Leiste — Ersatz für `<Tabs>` aus expo-router.
 *
 * Der Aktiv-Zustand kommt über `aria-current="page"`, das `NavLink` selbst
 * setzt: das ist gleichzeitig die Barrierefreiheits-Information und der
 * CSS-Hook für die Akzentfarbe. Damit ersetzt ein Attribut sowohl
 * `tabBarActiveTintColor` als auch `tabBarInactiveTintColor`.
 *
 * Der ganze Geometrie-Workaround der alten Leiste entfällt: React Navigation
 * rendert das Label mit `numberOfLines={1}` in einer 49-pt-Bar und schnitt
 * damit Unterlängen ab („g" in „Aufstellung"), was `tabBarIconStyle` und
 * `tabBarLabelStyle` gegensteuern mussten. In CSS gibt es das Problem nicht.
 */
const TABS: { name: LeagueTabName; Icon: (props: { size?: number }) => React.ReactElement }[] = [
  { name: 'lineup', Icon: PitchIcon },
  { name: 'players', Icon: SquadIcon },
  { name: 'market', Icon: TrendIcon },
  { name: 'league', Icon: LeagueIcon },
  { name: 'more', Icon: MoreIcon },
];

interface TabBarProps {
  leagueId: string;
}

export function TabBar({ leagueId }: TabBarProps) {
  return (
    <nav className={styles.bar} aria-label="Liga-Bereiche">
      {TABS.map(({ name, Icon }) => (
        <NavLink key={name} to={`/${leagueId}/${name}`} className={styles.tab}>
          <span className={styles.icon}>
            <Icon size={25} />
          </span>
          <span className={styles.label}>{leagueTabTitles[name]}</span>
        </NavLink>
      ))}
    </nav>
  );
}

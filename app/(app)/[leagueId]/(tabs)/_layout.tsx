import { Tabs } from 'expo-router';
import { LeagueSwitcher } from '@/components/LeagueSwitcher';
import { LeagueIcon } from '@/components/icons/LeagueIcon';
import { MoreIcon } from '@/components/icons/MoreIcon';
import { PitchIcon } from '@/components/icons/PitchIcon';
import { SquadIcon } from '@/components/icons/SquadIcon';
import { TrendIcon } from '@/components/icons/TrendIcon';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { colors } from '@/theme/tokens';

export default function LeagueTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitle: () => <LeagueSwitcher />,
        headerTitleAlign: 'center',
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="lineup"
        options={{
          title: leagueTabTitles.lineup,
          tabBarIcon: ({ color, size }) => <PitchIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: leagueTabTitles.squad,
          tabBarIcon: ({ color, size }) => <SquadIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="value"
        options={{
          title: leagueTabTitles.value,
          tabBarIcon: ({ color, size }) => <TrendIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="league"
        options={{
          title: leagueTabTitles.league,
          tabBarIcon: ({ color, size }) => <LeagueIcon color={color} size={size} />,
        }}
      />
<Tabs.Screen
        name="more"
        options={{
          title: leagueTabTitles.more,
          // Überschreibt den LeagueSwitcher aus screenOptions: auf diesem Tab
          // ist nichts liga-spezifisch, ein Liga-Umschalter im Titel wäre nur
          // irreführend.
          headerTitle: leagueTabTitles.more,
          tabBarIcon: ({ color, size }) => <MoreIcon color={color} size={size} />,
        }} />
    </Tabs>
  );
}

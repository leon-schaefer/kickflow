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
        // Der Tab-Balken ist 49 pt hoch, davon geht Padding (2x5) und die
        // Icon-Box (28) ab — für das Label bleiben 11 pt, es braucht aber ~12.
        // Als Flex-Kind schrumpft es deshalb und schneidet, weil die Navigation
        // es mit `numberOfLines={1}` (overflow: hidden) rendert, unten die
        // Unterlängen ab: das „g“ in „Aufstellung“ und „Liga“. Die Icon-Box auf
        // die tatsächliche Icon-Größe (25) zu kürzen schafft den Platz,
        // feste Zeilenhöhe und `flexShrink: 0` halten ihn.
        tabBarIconStyle: { height: 26 },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 12, flexShrink: 0 },
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
        name="market"
        options={{
          title: leagueTabTitles.market,
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

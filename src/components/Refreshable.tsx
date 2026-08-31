import { RefreshControl } from 'react-native';
import { colors } from '@/theme/tokens';
import type { RefreshableProps } from './Refreshable.types';

/**
 * Native Plattform: reicht einfach `RefreshControl` durch — iOS-Bounce bzw.
 * Android-SwipeRefreshLayout kommen kostenlos vom System, kein eigener
 * Wrapper, kein Layout-Eingriff. Das Web-Pendant (Refreshable.web.tsx)
 * simuliert dieselbe Geste per Touch-Handler, weil RefreshControl auf
 * react-native-web ein No-op ist.
 */
export function Refreshable({ refreshing, onRefresh, children }: RefreshableProps) {
  return children({
    refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />,
  });
}

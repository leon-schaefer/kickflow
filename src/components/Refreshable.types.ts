import type { ReactElement } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Props, die eine `Refreshable`-Kindfunktion an ihren Scroller (ScrollView /
 * FlatList / SectionList) spreadet: `onScroll` + `scrollEventThrottle`, damit
 * Refreshable.tsx die Scrollposition kennt und einen Pull nur am obersten
 * Rand als solchen wertet.
 */
export interface RefreshableChildProps {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export interface RefreshableProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: (props: RefreshableChildProps) => ReactElement;
}

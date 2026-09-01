import type { ReactElement } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, RefreshControlProps } from 'react-native';

/**
 * Props, die eine `Refreshable`-Kindfunktion an ihren Scroller (ScrollView /
 * FlatList / SectionList) spreadet. Auf Web zusätzlich `onScroll` +
 * `scrollEventThrottle`, damit Refreshable.web.tsx die Scrollposition kennt —
 * auf nativ bleiben die einfach ungenutzt, wenn der Scroller sie nicht braucht.
 */
export interface RefreshableChildProps {
  refreshControl?: ReactElement<RefreshControlProps>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export interface RefreshableProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: (props: RefreshableChildProps) => ReactElement;
}

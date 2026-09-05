import type { ReactElement, UIEvent } from 'react';

/**
 * Props, die eine `Refreshable`-Kindfunktion an ihren Scroll-Container
 * spreadet, damit Refreshable.tsx die Scrollposition kennt und einen Pull nur
 * am obersten Rand als solchen wertet.
 *
 * `scrollEventThrottle` ist mit dem Umzug weggefallen: das war eine
 * React-Native-Option, im Browser sind Scroll-Events ohnehin an Frames
 * gekoppelt.
 *
 * Der Render-Prop bleibt trotzdem — obwohl der Wrapper die Events auch selbst
 * per `addEventListener('scroll', …, {capture: true})` einsammeln könnte. Dann
 * sähe er aber auch die Scroll-Events HORIZONTALER Kinder-Scroller, und davon
 * gibt es welche innerhalb eines Refreshable (das Restprogramm hat einen). Eine
 * Heuristik zum Aussortieren wäre fragiler als ein explizites
 * `onScroll={p.onScroll}` an der richtigen Stelle.
 */
export interface RefreshableChildProps {
  onScroll?: (event: UIEvent<HTMLElement>) => void;
}

export interface RefreshableProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: (props: RefreshableChildProps) => ReactElement;
}

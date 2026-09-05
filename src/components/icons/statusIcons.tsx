import type { BadgeStatus } from '@/theme/tokens';
import { AwayIcon } from './AwayIcon';
import { DoubtfulIcon } from './DoubtfulIcon';
import { InjuredIcon } from './InjuredIcon';
import { RehabIcon } from './RehabIcon';
import { SuspendedIcon } from './SuspendedIcon';
import type { TabIconProps } from './types';
import { UnknownIcon } from './UnknownIcon';

/**
 * Status → Icon. Die Map lag vor dem Umzug als `statusIcons` in tokens.ts und
 * hielt SF-Symbol- bzw. Material-Namen für expo-symbols; hier stehen jetzt
 * eigene SVGs, weil tokens.ts (Quelle von `npm run tokens`) keine Komponenten
 * importieren darf.
 *
 * Über `BadgeStatus` getippt, nicht über `PlayerStatus`: `fit` bekommt kein
 * Badge und taucht deshalb gar nicht erst als `null`-Eintrag auf — die
 * Ausnahme steht einmal in `statusShowsBadge` und nicht noch einmal hier.
 * Ein neuer Status bleibt trotzdem ein Typfehler, solange die Map
 * vollständig sein muss.
 */
export const statusIcons: Record<BadgeStatus, (props: TabIconProps) => React.ReactElement> = {
  injured: InjuredIcon,
  doubtful: DoubtfulIcon,
  rehab: RehabIcon,
  suspended: SuspendedIcon,
  away: AwayIcon,
  unknown: UnknownIcon,
};

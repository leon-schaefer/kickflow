import type { PlayerStatus, Position } from '@/api/kickbase';

/** Zentrale Design-Tokens. Dark-first, Rasengrün als Akzent. */
export const colors = {
  background: '#0B0F0C',
  surface: '#141B15',
  surfaceRaised: '#1D261E',
  border: '#2A342B',

  textPrimary: '#F3F6F3',
  textSecondary: '#9BAA9C',
  textMuted: '#6B786C',

  accent: '#3FBF63',
  accentMuted: '#274A31',

  pitch: '#1E5C33',
  pitchLine: 'rgba(255,255,255,0.35)',

  positive: '#3FBF63',
  negative: '#E5484D',

  danger: '#E5484D',
} as const;

export const positionColors: Record<Position, string> = {
  GK: '#E0A83F',
  DEF: '#3F8FE0',
  MID: '#3FBF63',
  FWD: '#E0523F',
};

export const positionLabels: Record<Position, string> = {
  GK: 'TW',
  DEF: 'ABW',
  MID: 'MF',
  FWD: 'ANG',
};

export const statusColors: Record<PlayerStatus, string> = {
  fit: colors.positive,
  injured: colors.danger,
  doubtful: '#E0A83F',
  rehab: '#E0A83F',
  suspended: colors.danger,
  away: colors.textMuted,
  unknown: colors.textMuted,
};

export const statusLabels: Record<PlayerStatus, string> = {
  fit: 'Fit',
  injured: 'Verletzt',
  doubtful: 'Angeschlagen',
  rehab: 'Aufbautraining',
  suspended: 'Gesperrt',
  away: 'Abwesend',
  unknown: 'Unbekannt',
};

/**
 * Ob ein Status überhaupt ein Badge bekommt. `fit` bekommt keines — ein Hinweis
 * auf "alles in Ordnung" ist keiner.
 *
 * Hielt vorher die Icon-Map `statusIcons` fest (SF Symbols bzw. Material
 * Symbols über expo-symbols, mit `null` für `fit`). Die Icons sind mit dem
 * Umzug weg, weil auf Web ohnehin nur der Farbpunkt rendert — diese eine
 * Information musste aber bleiben.
 */
export function statusShowsBadge(status: PlayerStatus): boolean {
  return status !== 'fit';
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

export const layout = {
  maxContentWidth: 480,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
};

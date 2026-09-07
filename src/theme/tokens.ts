import type { PlayerStatus, Position } from '@/api/kickbase';

/** Zentrale Design-Tokens. Dark-first, Rasengrün als Akzent. */
export const colors = {
  background: '#0B0F0C',
  surface: '#141B15',
  surfaceRaised: '#1D261E',
  border: '#2A342B',

  textPrimary: '#F3F6F3',
  textSecondary: '#9BAA9C',
  /**
   * Aufgehellt von #6B786C auf #849085, damit die Farbe WCAG 2.2 AA (4.5:1 für
   * Text unter 18pt) auf ALLEN drei Flächen erreicht und nicht nur auf der
   * dunkelsten.
   *
   * Die alte Fassung lag bei 4.16:1 auf `background`, 3.78:1 auf `surface` und
   * 3.36:1 auf `surfaceRaised` — also überall darunter. Das war kein Randfall:
   * die Var hängt an rund 55 Regeln, und zwar durchweg an den KLEINEN Rollen
   * (`--font-size-small` = 11px, `--font-size-caption` = 13px). Genau dort
   * greift die 4.5:1-Schwelle, denn die 3:1-Ausnahme gilt erst ab 18pt bzw.
   * 14pt+bold.
   *
   * #849085 ist der kleinste Schritt Richtung Weiß, der auf der hellsten Fläche
   * (`surfaceRaised`) noch Luft über 4.5:1 lässt (4.68:1) — bewusst kein
   * größerer, damit „gedämpft" gedämpft bleibt. Der Abstand zu `textSecondary`
   * bleibt mit 1.37:1 sichtbar, die drei Textstufen also unterscheidbar.
   *
   * Bewacht von contrast.test.ts — wer hier dreht, muss dort vorbei.
   */
  textMuted: '#849085',

  accent: '#3FBF63',
  accentMuted: '#274A31',

  pitch: '#1E5C33',
  pitchLine: 'rgba(255,255,255,0.35)',

  positive: '#3FBF63',
  /**
   * Aufgehellt von #E5484D auf #EB5A5F — dieselbe Rechnung wie bei
   * `textMuted`: als TEXT lag das alte Rot bei 3.98:1 auf `surfaceRaised` und
   * 4.48:1 auf `surface`, beides unter AA. Und Text ist es an rund 20 Stellen,
   * durchweg klein: die Fehlermeldungen in OfferModal/MarketListingModal
   * (Panel = `surface`, Felder darin = `surface-raised`), QueryState,
   * BudgetBar, OptimizerBar.
   *
   * Als reine GRAFIK (Rand, Icon) hätte #E5484D bleiben dürfen — dort gilt
   * WCAG 1.4.11 mit 3:1, und das war erfüllt. Zwei Rot-Töne für dieselbe
   * Bedeutung sind aber teurer als der minimale Farbschritt: die Fundstellen
   * mischen Text und Rand (LogoutButton hat beides), und wer sie auseinander-
   * hält, muss die Regel an jeder neuen Fundstelle erneut entscheiden.
   */
  negative: '#EB5A5F',

  danger: '#EB5A5F',
} as const;

/**
 * Die vier Positionsfarben. Sie sind BEIDES — Grafik (Ring in PlayerCard,
 * Marker auf dem Pitch, `-soft` als Flächenhintergrund) und Text: das
 * Positionskürzel („ANG") nimmt sie über `var(--pos)` als `color` in
 * PlayerRowFrame, SellAdviceRow, PlayerFilterBar und PlayerDetailScreen.
 *
 * Deshalb muss jede der vier die 4.5:1 für Text erreichen und nicht nur die
 * 3:1 für Grafik. GK, DEF und MID taten das schon (7.30 / 4.61 / 6.56 auf der
 * hellsten Fläche); FWD lag mit 4.04:1 darunter und ist von #E0523F auf
 * #E56552 aufgehellt — der kleinste Schritt, der auf `surfaceRaised` über 4.5
 * kommt (4.68:1).
 *
 * Bewacht von contrast.test.ts.
 */
export const positionColors: Record<Position, string> = {
  GK: '#E0A83F',
  DEF: '#3F8FE0',
  MID: '#3FBF63',
  FWD: '#E56552',
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

/** Jeder Status außer `fit` — also genau die, die ein Badge tragen. */
export type BadgeStatus = Exclude<PlayerStatus, 'fit'>;

/**
 * Ob ein Status überhaupt ein Badge bekommt. `fit` bekommt keines — ein Hinweis
 * auf "alles in Ordnung" ist keiner.
 *
 * Type Predicate statt `boolean`: nach dem Guard ist der Status auf
 * `BadgeStatus` verengt und indiziert die Icon-Map
 * (`components/icons/statusIcons.tsx`) ohne zweiten `fit`-Fall. Die Regel
 * steht damit weiterhin nur hier — die Map muss sie nicht wiederholen.
 */
export function statusShowsBadge(status: PlayerStatus): status is BadgeStatus {
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

  /**
   * Abstand, den der Inhalt in der installierten iOS-PWA zur oberen
   * Viewport-Kante hält.
   *
   * Zwei Dinge stecken darin, und die Reihenfolge ist wichtig:
   *
   * 1. Das Pflicht-Minimum: 40px. iOS legt über den oberen Rand eine Schicht,
   *    die alles darin verschmiert; am Screenshot ausgemessen reicht sie bis
   *    101pt ab Bildschirmkante, der Viewport beginnt ohne `viewport-fit=cover`
   *    erst bei rund 62pt. Die Differenz liegt IM Viewport. Alles darunter
   *    holt das Schmieren zurück — `iosStatusBand.test.ts` hält die Grenze
   *    fest, die ganze Messung steht in der index.html.
   * 2. Die Luft darüber, damit es nicht gequetscht aussieht. 40px war am Gerät
   *    zu wenig, 48px zu viel; 44px liegt dazwischen.
   *
   * Wer daran dreht, dreht an Punkt 2 — Punkt 1 ist gemessen und keine
   * Geschmacksfrage.
   */
  iosTopClearance: 44,

  /**
   * Dasselbe für die untere Kante, wo die Tab-Leiste sonst auf dem
   * Home-Indicator sitzt.
   *
   * Pflicht-Minimum sind hier 34px — die Zone, die Apple für den
   * Home-Indicator frei sehen will und die iOS auf Face-ID-Geräten als
   * `safe-area-inset-bottom` meldet, wenn es sie meldet. Auch 34px waren am
   * Gerät zu wenig; der Wert ist deshalb derselbe wie oben, was zusätzlich
   * gleich viel Luft an beiden Kanten gibt.
   */
  iosBottomClearance: 44,
} as const;

/**
 * Schriftfamilie und Basisgröße.
 *
 * Beides kam bis zum Umzug GRATIS von react-native-web: dessen `<Text>` hat
 * den Basisstil `font: '14px System'`, und `System` expandierte es zu genau
 * diesem Stack (react-native-web/dist/exports/StyleSheet/compiler/
 * createReactDOMStyle.js, `SYSTEM_FONT_STACK`). Ohne RNW greift der
 * Browser-Default — und der ist eine Serifenschrift. Die Werte stehen hier
 * wörtlich so, wie Produktion sie gerendert hat.
 *
 * `fontSize` ist nur die Erbgröße für Container, deren Kinder keine eigene
 * Rolle setzen; jede Rolle unten bringt ihre mit.
 */
export const baseFont = {
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  fontSize: 14,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
};

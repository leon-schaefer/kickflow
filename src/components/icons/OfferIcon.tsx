import type { TabIconProps } from './types';

/**
 * Auktionshammer für „eigenes Gebot liegt" in der Marktzeile.
 *
 * Ersetzt den grünen Punkt, der dort seit dem Umzug stand: der war der
 * `fallback` eines `SymbolView` mit Hammer-Symbol, und ohne geladene
 * Symbol-Font blieb genau der Punkt übrig — nicht unterscheidbar vom
 * Positionspunkt zwei Zeilen darüber.
 *
 * Der Schlagklotz unten ist nicht Zierrat: Kopf und Stiel allein lesen sich
 * bei 12 px als schräger Strich, erst die Grundlinie macht den Hammer daraus.
 */
export function OfferIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x={3.2}
        y={4}
        width={9}
        height={5.4}
        rx={1.6}
        fill={color}
        transform="rotate(-45 7.7 6.7)"
      />
      <path
        d="M10.6 9.8 17.5 16.7"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M12.5 21H21.5" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
    </svg>
  );
}

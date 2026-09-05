import type { TabIconProps } from './types';

/**
 * Medizinisches Kreuz für „Verletzt".
 *
 * Deutlich fetter gezeichnet als die Tab-Icons (Strichstärke 4 statt ~1.8):
 * Statusicons rendern bei 12–14 px, nicht bei 24 — bei Tab-Strichstärke bliebe
 * bei 12 px ein knapp 0,8 px breiter Strich übrig, der auf einem farbigen Ring
 * verschwindet. Die Arme reichen bis 5/19 statt bis zum Rand, damit das Kreuz
 * im Ring der PlayerCard nicht am Rand klebt.
 */
export function InjuredIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 5V19M5 12H19"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

import type { TabIconProps } from './types';

/**
 * Warndreieck mit Ausrufezeichen für „Angeschlagen" — einsatzfähig, aber mit
 * Vorbehalt.
 *
 * Gefülltes Dreieck mit ausgestanztem Ausrufezeichen (`fillRule="evenodd"`)
 * statt Kontur plus Strich: die Silhouette trägt die Bedeutung schon, bevor
 * das Innere lesbar wird. Die Aussparung zeigt den Untergrund — in der Zeile
 * die Fläche, im Ring der PlayerCard dessen Statusfarbe; beides hat genug
 * Kontrast zur Füllung, weil die Füllung dort ohnehin die Gegenfarbe ist.
 */
export function DoubtfulIcon({ color = 'currentColor', size = 14 }: TabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M10.7 3.6 1.4 19.7a1.5 1.5 0 0 0 1.3 2.3h18.6a1.5 1.5 0 0 0 1.3-2.3L13.3 3.6a1.5 1.5 0 0 0-2.6 0ZM12 8.6a1.3 1.3 0 0 1 1.3 1.4l-.35 4.2a.95.95 0 0 1-1.9 0L10.7 10A1.3 1.3 0 0 1 12 8.6ZM12 16.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z"
        fill={color}
        fillRule="evenodd"
      />
    </svg>
  );
}

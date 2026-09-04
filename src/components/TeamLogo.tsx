import type { CSSProperties } from 'react';
import styles from './TeamLogo.module.css';

interface TeamLogoProps {
  uri: string | null;
  size?: number;
}

/**
 * Vereinslogo. Kickbase liefert die meisten Logos als SVG, manche aber als
 * PNG/JPG — ein `<img>` rendert beides selbst.
 *
 * Bewusst kein Inline-SVG per `fetch()`: das bräuchte CORS-Header vom CDN,
 * ein `<img>` nicht. (Genau der Grund, aus dem hier vorher schon `<Image>`
 * statt `SvgUri` stand.)
 *
 * Ohne URL (unbekannter Gegner) ein leerer Platzhalter, damit die Zeile nicht
 * springt. Die Größe kommt als Custom Property, weil sie aus dem Aufrufer
 * stammt und pro Fundstelle verschieden ist (14–22px).
 */
export function TeamLogo({ uri, size = 20 }: TeamLogoProps) {
  const sizeStyle = { '--logo-size': `${size}px` } as CSSProperties;

  if (!uri) {
    return <span className={styles.placeholder} style={sizeStyle} />;
  }

  // Leeres alt: der Vereinsname steht an allen vier Fundstellen daneben, das
  // Logo wiederholt ihn nur.
  return <img src={uri} alt="" className={styles.logo} style={sizeStyle} loading="lazy" />;
}

export interface TabIconProps {
  /**
   * Default `currentColor`: die Farbe kommt dann aus CSS und muss nicht durch
   * Props wandern — die Tab-Leiste setzt sie über `aria-current` am Link.
   * Explizit übergeben wird sie nur noch, wo kein passender CSS-Kontext ist.
   */
  color?: string;
  size?: number;
}

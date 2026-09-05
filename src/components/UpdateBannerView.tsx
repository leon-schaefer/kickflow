import styles from './UpdateBannerView.module.css';

/**
 * Rein präsentational: der Banner selbst, ohne die Erkennung. Die steckt in
 * UpdateBanner.tsx, das auf das Event aus public/register-sw.js lauscht.
 *
 * Der Abstand nach oben kam vorher aus `useSafeAreaInsets().top` von
 * react-native-safe-area-context — jetzt aus `env(safe-area-inset-top)` im
 * CSS, addiert statt `max()`, weil der Banner schwebt und keine Kante füllt.
 * Ohne `viewport-fit=cover` in der index.html (dort steht, warum es fehlt)
 * meldet der Browser alle Insets als 0; dann bleiben die --space-sm stehen,
 * gemessen ab der Oberkante des sicheren Bereichs — und genau da gehört er
 * hin.
 *
 * Der `role="alert"` sitzt am Rahmen und nicht am Button: an ihm würde er die
 * Button-Rolle verdrängen, und der Banner wäre nicht mehr als Schaltfläche
 * angekündigt. Er erscheint unangekündigt mitten in der App — ohne die
 * Live-Region wäre die Meldung nur sehend wahrnehmbar.
 */
export function UpdateBannerView({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.frame} role="alert">
      <button type="button" className={styles.banner} onClick={onClick}>
        Neue Version verfügbar — antippen zum Aktualisieren
      </button>
    </div>
  );
}

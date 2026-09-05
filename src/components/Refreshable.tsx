import type { CSSProperties, UIEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { Spinner } from './Spinner';
import type { RefreshableProps } from './Refreshable.types';
import styles from './Refreshable.module.css';

const RESISTANCE = 0.5;
const THRESHOLD = 64;
/** Höhe, auf der der Inhalt während des Ladens stehen bleibt. */
const PARKED = 48;
const MAX_PULL = 96;
const SNAP_DURATION = 200;

/**
 * Pull-to-Refresh per Touch-Handler nachgebaut.
 *
 * Warum überhaupt selbst gebaut: die PWA-Shell setzt
 * `body { overflow: hidden; overscroll-behavior: none }` (index.html), weil
 * die App in ihren eigenen Containern scrollt — damit greift das native
 * Browser-Pull-to-Refresh nicht.
 *
 * Nur Touch (kein Wheel/Trackpad) — deckt den eigentlichen PWA-Anwendungsfall
 * ab, ohne Trackpad-Scrollmomentum versehentlich als Pull zu interpretieren.
 *
 * Die Auslenkung läuft über die CSS-Custom-Property `--pull` am Wrapper und
 * NICHT über React-State: ein `setState` pro `touchmove` wäre ein Rerender pro
 * Frame. Das entspricht dem, was die React-Native-Fassung mit
 * `Animated.Value` und `useNativeDriver: false` tat.
 *
 * WICHTIG: Modals müssen nach `document.body` portaliert bleiben. Die Listener
 * hier hängen nativ mit `capture` am Wrapper, und native Events laufen
 * ausschließlich die DOM-Vorfahrenkette hoch. Läge ein Dialog im Baum
 * darunter, würde ein Wisch darin einen Pull im Hintergrund auslösen — ein
 * `<dialog>` im Top Layer ändert daran nichts, Top-Layer-Rendering betrifft
 * nicht die Event-Propagation.
 */
export function Refreshable({ refreshing, onRefresh, children }: RefreshableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullValueRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);

  const handleScroll = useCallback((event: UIEvent<HTMLElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  }, []);

  const setPull = useCallback((value: number) => {
    pullValueRef.current = value;
    wrapperRef.current?.style.setProperty('--pull', String(value));
  }, []);

  /**
   * Fährt die Auslenkung animiert auf einen Wert. Die Transition ist nur
   * während des Snaps aktiv — eine dauerhafte würde den 1:1-Zug am Finger um
   * die Snap-Dauer verschleppen.
   */
  const snapTo = useCallback(
    (value: number) => {
      const node = wrapperRef.current;
      if (!node) return;
      node.dataset.snap = 'true';
      setPull(value);
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        snapTimerRef.current = null;
        wrapperRef.current?.removeAttribute('data-snap');
      }, SNAP_DURATION);
    },
    [setPull],
  );

  useEffect(
    () => () => {
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshing || scrollTopRef.current > 0 || e.touches.length !== 1) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0]!.clientY;
      pullingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      const dy = e.touches[0]!.clientY - startYRef.current;
      if (dy <= 0) {
        // Kein Pull (mehr) — normales Scrollen/diagonale Geste, Browser übernimmt.
        startYRef.current = null;
        pullingRef.current = false;
        return;
      }
      pullingRef.current = true;
      e.preventDefault();
      setPull(Math.min(MAX_PULL, dy * RESISTANCE));
    }

    function onTouchEnd() {
      startYRef.current = null;
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullValueRef.current >= THRESHOLD) {
        snapTo(PARKED);
        onRefresh();
      } else {
        snapTo(0);
      }
    }

    // touchmove non-passive + capture, damit preventDefault() das
    // Browser-Scrollen zuverlässig vor dem inneren Scroller abfängt.
    node.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    node.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
    return () => {
      node.removeEventListener('touchstart', onTouchStart, true);
      node.removeEventListener('touchmove', onTouchMove, true);
      node.removeEventListener('touchend', onTouchEnd, true);
      node.removeEventListener('touchcancel', onTouchEnd, true);
    };
  }, [onRefresh, refreshing, setPull, snapTo]);

  // Query(s) fertig -> zurück auf 0 fahren (deckt sowohl den geparkten Zustand
  // nach eigenem Pull als auch ein von außen gesetztes `refreshing` ab).
  //
  // Die Prüfung auf eine tatsächliche Auslenkung ist nicht Sparsamkeit: ohne
  // sie liefe der Effekt schon beim Mount, setzte `data-snap` und ließe es
  // 200 ms stehen. Ein Zug in diesem Fenster würde von der Transition
  // verschleppt — genau das, was sie vermeiden soll.
  useEffect(() => {
    if (!refreshing && pullValueRef.current !== 0) snapTo(0);
  }, [refreshing, snapTo]);

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      // Der Parkwert kommt aus der Konstante oben, damit die Deckkraft des
      // Indikators in CSS nicht dieselbe Zahl ein zweites Mal führt.
      style={{ '--pull-parked': PARKED } as CSSProperties}
    >
      <div className={styles.indicator}>
        {/* Steht dauerhaft im DOM und wird nur per Deckkraft eingeblendet —
            deshalb aus der Barrierefreiheit heraus. Den Ladezustand meldet
            der Inhalt, nicht dieser Zeiger. */}
        <Spinner decorative />
      </div>
      <div className={styles.content}>{children({ onScroll: handleScroll })}</div>
    </div>
  );
}

import { useObserve } from 'expo-observe';
import { useEffect } from 'react';

/**
 * Meldet EAS Observe, dass dieser Screen benutzbar ist, und schließt damit die
 * TTI-Messung (Time to Interactive) ab. Observe misst nur TTR (erster Frame)
 * von allein — wann der erste Frame tatsächlich mehr als einen Spinner zeigt,
 * weiß nur der Screen selbst.
 *
 * Deshalb `ready`: `true` erst, wenn der Screen die Daten hat, die er zum
 * Anzeigen braucht — bei den meisten Screens hier also genau dann, wenn nicht
 * mehr `<QueryState />` gerendert wird (siehe QueryState.tsx). Screens ohne
 * Daten-Abhängigkeit rufen den Hook mit `true` auf.
 *
 * Muss INNERHALB der Screen-Komponente laufen (nicht in einem Wrapper
 * darüber): `useObserve` liest die Route aus dem Navigations-Kontext und
 * warnt sonst mit "No metadata available for the current screen".
 *
 * Mehrfachaufrufe sind unschädlich — Observe verwertet pro Screen nur den
 * ersten, weitere werden verworfen.
 */
export function useMarkInteractive(ready: boolean) {
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (!ready) return;
    markInteractive();
  }, [ready, markInteractive]);
}

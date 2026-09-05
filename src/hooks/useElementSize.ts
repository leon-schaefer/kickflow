import { useCallback, useEffect, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

const ZERO: ElementSize = { width: 0, height: 0 };

/**
 * Gemessene Größe eines Elements — der Ersatz für RNs `onLayout`.
 *
 * Gibt einen Ref-CALLBACK zurück, keinen RefObject: MarketValueSparkline
 * hängt die Messung heute an zwei verschiedenen Knoten (Empty-Zweig und
 * Chart-Container). Ein RefObject plus Effect würde den Wechsel zwischen
 * beiden verpassen, weil der Effect nicht neu läuft, wenn sich nur
 * `ref.current` ändert. Der Callback läuft bei jedem Knotenwechsel.
 *
 * Auf ganze Pixel gerundet: ResizeObserver liefert subpixelgenaue Werte, die
 * sonst bei jedem Layout einen neuen State und damit eine Renderschleife
 * auslösen können.
 *
 * Hinweis für Tests: jsdom hat keinen ResizeObserver. src/test/setup.ts
 * stubbt ihn, sonst wirft jeder Test, der ein messendes Element mountet.
 */
export function useElementSize<T extends Element = HTMLDivElement>(): [
  (node: T | null) => void,
  ElementSize,
] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>(ZERO);

  const ref = useCallback((next: T | null) => {
    setNode(next);
  }, []);

  useEffect(() => {
    if (!node) {
      setSize(ZERO);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;

      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, size];
}

import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { buildDocumentTitle } from './documentTitle';

/** Was eine Route unter `handle` mitgeben kann, damit sie einen Titel bekommt. */
export interface RouteHandle {
  title?: string;
}

/**
 * Setzt `document.title` passend zur aktiven Route.
 *
 * Hängt in RootLayout und damit genau einmal im Baum — nicht in jedem Screen.
 * Der Grund ist nicht Sparsamkeit: 15 Screens mit je einem eigenen
 * `useEffect` wären 15 Stellen, an denen der Titel fehlen KANN, und beim
 * nächsten neuen Screen fehlt er dann auch. Über `useMatches()` ist der Titel
 * dagegen eine Eigenschaft des Route-Baums (`handle.title` in routes.tsx) —
 * eine Route ohne Titel fällt beim Lesen des Baums auf.
 *
 * `useMatches()` gibt die getroffenen Routen von außen nach innen; die Logik,
 * welcher davon gewinnt, steht in documentTitle.ts und ist dort geprüft.
 */
export function useDocumentTitle(): void {
  const matches = useMatches();
  const title = buildDocumentTitle(matches.map((m) => (m.handle as RouteHandle | undefined)?.title));

  useEffect(() => {
    // Nur schreiben, wenn sich etwas ändert. Ein `document.title =` mit
    // demselben Wert ist in Safari nicht folgenlos: es lässt den Tab-Titel
    // kurz aufblitzen.
    if (document.title !== title) document.title = title;
  }, [title]);
}

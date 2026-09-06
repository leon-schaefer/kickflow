/**
 * Fängt `beforeinstallprompt` ab und hält es fest.
 *
 * Das Event ist flüchtig in zwei Richtungen, und beide zwingen zu einem Store
 * außerhalb von React:
 *
 *  - Chromium feuert es kurz nach dem Laden, oft bevor irgendein Dialog
 *    montiert ist. Wer erst beim Mount zuhört, hört nichts mehr.
 *  - Ohne `preventDefault()` zeigt Chromium seine eigene Mini-Infobar. Genau
 *    die soll durch den Hinweis der App ersetzt werden.
 *
 * Deshalb hängen die Listener beim Laden des Moduls und nicht in einem
 * Effect. Vorbild ist src/auth/unauthorizedBus.ts — auch hier meldet etwas
 * außerhalb des Baums nach innen.
 *
 * `getInstallState()` liefert dasselbe Objekt zurück, solange sich nichts
 * ändert: `useSyncExternalStore` vergleicht Snapshots per Identität und
 * würde bei einem frisch gebauten Objekt pro Aufruf endlos neu rendern.
 */

/** Nicht standardisiert, deshalb hier von Hand — TS kennt das Event nicht. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** Das abgefangene Event, oder null. Nach `prompt()` verbraucht. */
  prompt: BeforeInstallPromptEvent | null;
  /** Der Browser hat die Installation gemeldet (`appinstalled`). */
  installed: boolean;
}

let state: InstallState = { prompt: null, installed: false };

const listeners = new Set<() => void>();

function setState(next: InstallState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function getInstallState(): InstallState {
  return state;
}

export function onInstallStateChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Nach `prompt()` ist das Event verbraucht — ein zweiter Aufruf wirft. Der
 * Aufrufer meldet es deshalb hier ab.
 */
export function clearInstallPrompt(): void {
  setState({ ...state, prompt: null });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setState({ ...state, prompt: event as BeforeInstallPromptEvent });
  });

  window.addEventListener('appinstalled', () => {
    setState({ prompt: null, installed: true });
  });
}

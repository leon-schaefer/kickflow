import { useCallback, useState, useSyncExternalStore } from 'react';
import { INSTALL_HINT_KEY } from '@/storage/keys';
import localStore from '@/storage/local';
import { type InstallHintKind, installHintKind } from './installHint';
import { isStandalone } from './standalone';
import {
  clearInstallPrompt,
  getInstallState,
  onInstallStateChange,
} from './installPromptStore';

/**
 * Verbindet die Umgebung (Standalone? Merker gesetzt? Event abgefangen?) mit
 * der Entscheidung aus installHint.ts.
 *
 * Der Merker wird SYNCHRON gelesen (`getItemSync`, wie
 * src/leagues/lastLeague.ts): an ihm hängt keine `loaded`-Semantik, und über
 * ein Promise blitzte der Dialog bei jedem Start kurz auf, bevor der
 * gespeicherte Stand ihn wieder schließt.
 */
function readSeen(): boolean {
  return localStore.getItemSync(INSTALL_HINT_KEY) !== null;
}

export interface InstallHint {
  /** null = nichts anbieten. */
  kind: InstallHintKind | null;
  /** Nur für `kind === 'native'` belegt: löst den Browser-Dialog aus. */
  install: () => Promise<void>;
  /** Wegtippen — merkt sich das dauerhaft. */
  dismiss: () => void;
}

export function useInstallHint(active: boolean): InstallHint {
  const state = useSyncExternalStore(onInstallStateChange, getInstallState);
  // Beides ändert sich während einer Sitzung nicht von selbst: der Merker
  // wird nur hier gesetzt (dann über den State), und aus einem Tab wird ohne
  // Neustart keine installierte PWA.
  const [standalone] = useState(isStandalone);
  const [seen, setSeen] = useState(readSeen);

  const remember = useCallback(() => {
    setSeen(true);
    localStore.setItem(INSTALL_HINT_KEY, '1');
  }, []);

  const install = useCallback(async () => {
    const event = getInstallState().prompt;
    // Erst abmelden, dann fragen: das Event ist nach `prompt()` verbraucht,
    // ein zweiter Aufruf würde werfen.
    clearInstallPrompt();
    remember();
    if (!event) return;
    await event.prompt();
  }, [remember]);

  const kind = installHintKind({
    // `appinstalled` kommt, während der Dialog offen steht — der Hinweis ist
    // damit erledigt, auch wenn `display-mode` im laufenden Tab noch der alte
    // ist.
    standalone: standalone || state.installed,
    seen,
    hasPrompt: state.prompt !== null,
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints,
  });

  return { kind: active ? kind : null, install, dismiss: remember };
}

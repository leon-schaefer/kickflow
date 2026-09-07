import { APP_KEY_PREFIX } from './keys';

/**
 * Ersatz für `@react-native-async-storage/async-storage`.
 *
 * Die Signaturen bleiben absichtlich Promise-basiert, obwohl localStorage
 * synchron ist: useLeagueRules und useExcludedFromSale hängen ihre
 * `loaded`-Semantik ("bis der gespeicherte Stand da ist, gelten die
 * Defaults") an der Asynchronität, und mehrere Kommentare dort begründen sie.
 * Ein synchroner Umbau würde diese Semantik samt Aufrufern anfassen; so
 * bleibt es ein Import-Tausch.
 *
 * Vorbild ist src/auth/tokenStore.ts, das localStorage genauso synchron liest
 * und trotzdem `async` nach außen gibt.
 *
 * Alle Zugriffe sind gekapselt: im privaten Modus und bei blockierten
 * Site-Daten wirft schon der Zugriff auf `window.localStorage`.
 */
/**
 * Synchrone Variante. Nur für Werte, an denen KEINE `loaded`-Semantik hängt —
 * derzeit die zuletzt genutzte Liga (src/leagues/lastLeague.ts) und der
 * Merker des Installations-Hinweises (src/pwa/useInstallHint.ts), beide im
 * useState-Initializer gelesen. Dieselbe Kapselung, nur ohne das Promise
 * davor.
 */
function getItemSync(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function getItem(key: string): Promise<string | null> {
  return getItemSync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kein Speicher verfügbar (privater Modus, Kontingent voll) — der Wert
    // ist für diese Sitzung im State, nur nicht dauerhaft. Kein Grund, den
    // Aufrufer scheitern zu lassen.
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // s.o.
  }
}

/**
 * Löscht ALLES, was kickflow im localStorage angelegt hat — die Auskunft
 * „meine Daten löschen" aus dem Einstellungen-Screen.
 *
 * Über das Präfix und nicht über eine Liste von Schlüsseln, weil die Liste
 * nicht endlich ist: Regeln und Verkaufs-Ausschlüsse gibt es je Liga (siehe
 * `APP_KEY_PREFIX` in keys.ts). Eine Aufzählung wäre genau die Art von
 * Duplikat, die still veraltet — der nächste neue Schlüssel bliebe liegen,
 * und ein „gelöscht", das nicht alles löscht, ist schlimmer als keines.
 *
 * Fremde Schlüssel bleiben unangetastet: `localStorage.clear()` würde auf
 * derselben Origin alles wegräumen, auch was nicht uns gehört.
 *
 * Erst sammeln, dann löschen. Ein `removeItem` während des Index-Durchlaufs
 * verschiebt die nachfolgenden Indizes und überspränge jeden zweiten Treffer.
 */
function clearAppData(): number {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(APP_KEY_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
    return doomed.length;
  } catch {
    // Kein Speicher verfügbar — dann gibt es auch nichts zu löschen.
    return 0;
  }
}

export const localStore = { getItem, getItemSync, setItem, removeItem, clearAppData };

export default localStore;

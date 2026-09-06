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

export const localStore = { getItem, getItemSync, setItem, removeItem };

export default localStore;

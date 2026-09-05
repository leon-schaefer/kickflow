/**
 * Winziges Semaphor, damit N gleichzeitige Requests nicht als Burst bei
 * Cloudflare landen (Kickbase hängt dahinter, siehe Kommentar in
 * src/queries/useRefresh.ts). Gebraucht für die Punkte/Min-Kennzahl im
 * Spieler- und im Markt-Tab: dort steht ein `/performance`-Request pro
 * Spieler an, also schnell 20–30 auf einmal.
 *
 * WICHTIG: Das Gate liegt UM den fetch-Aufruf, nicht darin — sonst würde der
 * 10-Sekunden-Timeout aus client.ts bereits in der Warteschlange laufen und
 * wartende Requests mit einem Fake-Timeout abbrechen.
 */

export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Lässt höchstens `max` Tasks gleichzeitig laufen, in FIFO-Reihenfolge. */
export function createLimiter(max: number): Limiter {
  let active = 0;
  const queue: (() => void)[] = [];

  /**
   * Gibt den Slot direkt an den nächsten Warter WEITER, statt ihn erst
   * freizugeben. Andernfalls könnte ein zwischen `active -= 1` und dem
   * Fortsetzen des Warters (eigener Microtask) eintreffender Aufrufer denselben
   * Slot belegen — das Limit wäre kurzzeitig um 1 überschritten.
   */
  function release() {
    const next = queue.shift();
    if (next) next();
    else active -= 1;
  }

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) {
      // Kein `active += 1` danach: release() hat den Slot schon übergeben.
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      active += 1;
    }
    try {
      return await task();
    } finally {
      // finally, damit ein abgelehnter Task die Queue nicht dauerhaft blockiert.
      release();
    }
  };
}

/** Gate für die Spielzeit-Abfragen (getPlayerPerformance). */
export const withPerformanceLimit = createLimiter(4);

/**
 * Gate für die Rivalen-Elf im Liga-Tab (getPlayerBasic): bis zu 11 fremde
 * Spieler-IDs auf einmal, sonst derselbe Burst-Effekt wie bei der
 * Spielzeit-Spalte oben — eigenes Gate statt withPerformanceLimit
 * mitzubenutzen, damit ein Spielerdetail-Screen mit paralleler
 * Spielzeit-Abfrage nicht in dieselbe Warteschlange gerät.
 */
export const withPlayerLookupLimit = createLimiter(4);

/**
 * Gate für die Transferhistorie (getPlayerTransferHistory): der Spieler-Screen
 * holt sie für EINEN Spieler, die Kaufen/Verkaufen-Liste dagegen für den
 * ganzen Kader auf einmal — also 20–25 Requests, sobald sie aufgeklappt wird.
 * Eigenes Gate aus demselben Grund wie unten: die Warteschlange des Kaders
 * soll den Spieler-Screen nicht ausbremsen.
 */
export const withTransferHistoryLimit = createLimiter(4);

/**
 * Gate für den competition-weiten Spielerbestand (getCompetitionPlayers): ein
 * Request pro Verein, also 18 auf einmal beim ersten Öffnen des Spieler-Tabs.
 * Eigenes Gate aus demselben Grund wie oben — die Warteschlange des
 * Spielerbestands soll die Rivalen-Elf und die Spielzeit-Spalte nicht
 * ausbremsen.
 */
export const withCompetitionPlayersLimit = createLimiter(4);

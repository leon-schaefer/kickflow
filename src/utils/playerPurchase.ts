/**
 * "Wann habe ich diesen Spieler gekauft?" — abgeleitet aus der
 * Transferhistorie des Spielers (`getPlayerTransferHistory`).
 *
 * Reiner Helfer ohne UI, Vorbild playerOwnership.ts: die Zuordnung soll ohne
 * gerenderten Screen testbar bleiben.
 */
import type { PlayerTransfer } from '@/api/kickbase';

export interface OwnPurchaseSources {
  /** Transferhistorie des Spielers. Reihenfolge egal — hier wird selbst sortiert. */
  transfers: readonly PlayerTransfer[];
  /**
   * Eigene Kickbase-User-ID, wenn bekannt. Nach einem App-Neustart ist sie
   * `null`, weil AuthProvider sie nur für die Dauer der Session hält — der
   * Kauf lässt sich trotzdem bestimmen, siehe unten.
   */
  ownUserId: string | null;
  /** Steht der Spieler JETZT im eigenen Kader (resolvePlayerOwner → 'me')? */
  inOwnSquad: boolean;
}

/**
 * Der Transfer, mit dem der Spieler in den eigenen Kader gekommen ist —
 * `null`, wenn er sich nicht belegen lässt.
 *
 * Der Schluss steht und fällt mit `inOwnSquad`: gehört der Spieler mir, dann
 * ist der JÜNGSTE Transfer zwangsläufig meiner, denn sein Käufer ist der
 * aktuelle Besitzer. Genau deshalb funktioniert die Anzeige auch ohne
 * bekannte eigene User-ID.
 *
 * Ist sie bekannt, dient sie als Gegenprobe: nennt der jüngste Transfer einen
 * ANDEREN Manager als Käufer, widerspricht die Historie dem Kaderstand (z. B.
 * weil eine der beiden Quellen hinterherhinkt). Dann lieber nichts anzeigen
 * als ein falsches Datum. Ein Eintrag ganz ohne Käufer ist dagegen kein
 * Widerspruch — laut Doku fehlt `u` bei manchen Transfers schlicht.
 *
 * Verkaufte Spieler sind bewusst nicht abgedeckt: `inOwnSquad === false`
 * liefert immer `null`, auch wenn ich den Spieler früher einmal besessen habe.
 */
export function resolveOwnPurchase({
  transfers,
  ownUserId,
  inOwnSquad,
}: OwnPurchaseSources): PlayerTransfer | null {
  if (!inOwnSquad) return null;

  const latest = transfers.reduce<PlayerTransfer | null>(
    (newest, transfer) =>
      newest === null || Date.parse(transfer.date) > Date.parse(newest.date) ? transfer : newest,
    null,
  );
  if (!latest) return null;

  if (ownUserId !== null && latest.buyerId !== null && latest.buyerId !== ownUserId) return null;

  return latest;
}

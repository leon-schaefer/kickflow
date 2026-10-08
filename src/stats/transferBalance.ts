/**
 * „Mein größter Transfergewinn" und „mein größter Reinfall" — aus derselben
 * Transferhistorie, aus der der Spieler-Screen sein „Gekauft am …" zieht
 * (`getPlayerTransferHistory`, ausgewertet in utils/playerPurchase.ts).
 *
 * Die Historie eines Spielers ist eine Kette von BESITZERWECHSELN: je Eintrag
 * ein Käufer und der Preis, den er gezahlt hat. Ein eigener Transfergewinn
 * steckt also immer in zwei benachbarten Einträgen — der eine, in dem ICH
 * kaufe, und der nächste, in dem mir jemand den Spieler abkauft. Genau diese
 * Paare sucht `buildTransferSpells`; ein Spieler kann mehrere davon haben
 * (gekauft, verkauft, zurückgekauft), deshalb eine Zeile je Besitzzeitraum und
 * nicht je Spieler.
 *
 * Zwei Grenzen, die der Screen benennen muss, statt sie zu verschweigen:
 *
 *  - OHNE eigene User-ID geht gar nichts. Der Kauf ist nur daran zu erkennen,
 *    dass ICH der Käufer bin. Anders als in resolveOwnPurchase() gibt es hier
 *    keinen Ersatzschluss über den aktuellen Kader: der greift genau für den
 *    jüngsten Transfer eines Spielers, den ich JETZT besitze — also für keinen
 *    einzigen verkauften, und die sind hier der Punkt.
 *  - Ein Verkauf ans Kickbase-Angebot taucht in der Historie nicht
 *    zwangsläufig als nächster Eintrag auf. Ein Besitzzeitraum ohne Nachfolger
 *    und ohne aktuellen Kaderplatz bleibt deshalb unbewertet, statt geraten zu
 *    werden.
 */
import type { PlayerTransfer } from '@/api/kickbase';

/** Ein abgeschlossener oder noch laufender eigener Besitzzeitraum. */
export interface TransferSpell {
  playerId: string;
  name: string;
  buyPrice: number;
  buyDate: string;
  /** `null`, solange der Spieler noch im eigenen Kader steht. */
  sellPrice: number | null;
  sellDate: string | null;
  /**
   * Verkaufspreis − Kaufpreis; bei noch gehaltenen Spielern der heutige
   * Marktwert − Kaufpreis.
   */
  profit: number;
  /** `false` = Buchgewinn gegen den Marktwert, noch nicht eingelöst. */
  realized: boolean;
}

export interface TransferBalanceInput {
  /** playerId → Transferhistorie. Reihenfolge egal, hier wird selbst sortiert. */
  transfersByPlayer: ReadonlyMap<string, readonly PlayerTransfer[]>;
  /** Eigene Kickbase-User-ID. `null` → leeres Ergebnis, siehe Modulkopf. */
  ownUserId: string | null;
  /** playerId → Anzeigename. Fehlt er, steht die ID da. */
  names: ReadonlyMap<string, string>;
  /** playerId → heutiger Marktwert, für noch gehaltene Spieler. */
  marketValues: ReadonlyMap<string, number>;
  /** Wer JETZT im eigenen Kader steht — entscheidet über „noch gehalten". */
  ownSquad: ReadonlySet<string>;
}

/**
 * Alle eigenen Besitzzeiträume mit belegbarem Ergebnis, der größte Gewinn
 * zuerst.
 *
 * Übersprungen wird ein Zeitraum, dessen Kaufpreis fehlt (`trp === null`, laut
 * Doku möglich) oder dessen Ende sich nicht belegen lässt — ein Gewinn, den
 * die Antwort nicht hergibt, ist schlechter als eine Zeile weniger.
 */
export function buildTransferSpells({
  transfersByPlayer,
  ownUserId,
  names,
  marketValues,
  ownSquad,
}: TransferBalanceInput): TransferSpell[] {
  if (!ownUserId) return [];

  const spells: TransferSpell[] = [];

  for (const [playerId, transfers] of transfersByPlayer) {
    // Aufsteigend: der Verkauf ist der Eintrag NACH dem eigenen Kauf, und
    // toPlayerTransfers() liefert absteigend (jüngster zuerst).
    const chain = [...transfers].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    chain.forEach((transfer, index) => {
      if (transfer.buyerId !== ownUserId || transfer.price === null) return;

      const buy = {
        playerId,
        name: names.get(playerId) || `Spieler ${playerId}`,
        buyPrice: transfer.price,
        buyDate: transfer.date,
      };

      const next = chain[index + 1];
      if (next) {
        if (next.price === null) return;
        spells.push({
          ...buy,
          sellPrice: next.price,
          sellDate: next.date,
          profit: next.price - buy.buyPrice,
          realized: true,
        });
        return;
      }

      // Kein Nachfolger: entweder halte ich ihn noch — dann ist der Marktwert
      // der ehrlichste Gegenwert — oder er ist auf einem Weg abgegangen, den
      // die Historie nicht zeigt. Dann lieber keine Zeile.
      const marketValue = marketValues.get(playerId);
      if (!ownSquad.has(playerId) || marketValue === undefined) return;
      spells.push({
        ...buy,
        sellPrice: null,
        sellDate: null,
        profit: marketValue - buy.buyPrice,
        realized: false,
      });
    });
  }

  return spells.sort((a, b) => b.profit - a.profit || Date.parse(b.buyDate) - Date.parse(a.buyDate));
}

export interface TransferSummary {
  /** Summe der Gewinne/Verluste aus abgeschlossenen Verkäufen. */
  realizedProfit: number;
  /** Summe der Buchgewinne auf noch gehaltene Spieler. */
  openProfit: number;
  /** Bester bzw. schlechtester Zeitraum — `null` bei leerer Liste. */
  best: TransferSpell | null;
  worst: TransferSpell | null;
  realizedCount: number;
}

/**
 * Realisiert und unrealisiert bleiben GETRENNT: ein Buchgewinn auf einen
 * Spieler, den man noch hat, ist keine eingelöste Mark — und eine Zahl, die
 * beides vermischt, wäre genau die Zahl, auf die man sich nicht verlassen
 * kann.
 */
export function summarizeTransfers(spells: readonly TransferSpell[]): TransferSummary {
  const realized = spells.filter((spell) => spell.realized);

  // Bestes/schlechtestes Geschäft werden GESUCHT und nicht von den Enden der
  // Liste gelesen: buildTransferSpells sortiert zwar nach Gewinn, aber die
  // Zusammenfassung soll auch für eine gefilterte oder anders sortierte Liste
  // stimmen.
  const extreme = (pick: (a: TransferSpell, b: TransferSpell) => TransferSpell) =>
    realized.reduce<TransferSpell | null>((best, spell) => (best === null ? spell : pick(best, spell)), null);

  return {
    realizedProfit: realized.reduce((sum, spell) => sum + spell.profit, 0),
    openProfit: spells.filter((spell) => !spell.realized).reduce((sum, spell) => sum + spell.profit, 0),
    best: extreme((a, b) => (b.profit > a.profit ? b : a)),
    worst: extreme((a, b) => (b.profit < a.profit ? b : a)),
    realizedCount: realized.length,
  };
}

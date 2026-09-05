/**
 * Reine Helfer für den „Auf den Markt stellen"-Dialog
 * (src/components/MarketListingModal.tsx) — dasselbe Muster wie utils/offer.ts
 * beim Bieten: das Formular bleibt dumm, Vorbelegung, Preisrechnung und Summen
 * sind isoliert testbar.
 *
 * Der Dialog listet MEHRERE Spieler auf einmal (den Pflichtverkaufsplan aus
 * utils/sellPlan.ts), deshalb ist der Zustand hier eine Liste von Einträgen
 * und nicht wie beim Gebot ein einzelnes Preisfeld. Der Preistext bleibt
 * bewusst Text und wird nicht bei jeder Eingabe zur Zahl geronnen — sonst
 * verliert das Feld führende Nullen und Zwischenstände beim Tippen.
 */
import type { ListPlayerInput } from '@/api/kickbase';
import { formatCurrencyInput, parseCurrencyInput } from './offer';

/** Die Teilmenge von SquadPlayer, die der Dialog braucht. */
export interface ListingCandidate {
  id: string;
  name: string;
  marketValue: number;
  /** SquadPlayer.onMarket — steht der Spieler schon am Transfermarkt? */
  onMarket: boolean;
}

export interface ListingEntry {
  playerId: string;
  name: string;
  marketValue: number;
  /** Angebotspreis als Feldtext ("6.112.964"), siehe formatCurrencyInput. */
  priceText: string;
  selected: boolean;
  /**
   * true = steht bereits am Markt. Solche Einträge bleiben sichtbar (sonst
   * fehlte ein Pflichtverkauf kommentarlos in der Liste), sind aber nie
   * ausgewählt — ein zweites Listing desselben Spielers wäre bestenfalls ein
   * vergeblicher Request.
   */
  alreadyListed: boolean;
}

/**
 * Angebotspreis zum Aufschlag auf den Marktwert: 0 = Marktwert, 0.05 = +5 %.
 * Ein Verkauf an Kickbase bringt exakt den Marktwert, ein Mitspieler zahlt
 * erfahrungsgemäß mehr — deshalb ist der Aufschlag eine Wahl und keine
 * Vorgabe.
 */
export function priceWithMarkup(marketValue: number, markup: number): number {
  return Math.round(marketValue * (1 + markup));
}

/**
 * Baut den Formularzustand aus dem Verkaufsplan. `playerIds` kommt in der
 * Reihenfolge des Plans (`SellPlan.sell`), die zugleich die empfohlene
 * Verkaufsreihenfolge ist — sie bleibt hier erhalten. Unbekannte IDs fallen
 * heraus: ein Spieler, der nicht mehr im Kader ist, kann nicht gelistet werden.
 */
export function buildListingDraft(
  candidates: readonly ListingCandidate[],
  playerIds: readonly string[],
  markup = 0,
): ListingEntry[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return playerIds.flatMap((playerId) => {
    const candidate = byId.get(playerId);
    if (!candidate) return [];
    return [
      {
        playerId,
        name: candidate.name,
        marketValue: candidate.marketValue,
        priceText: formatCurrencyInput(priceWithMarkup(candidate.marketValue, markup)),
        selected: !candidate.onMarket,
        alreadyListed: candidate.onMarket,
      },
    ];
  });
}

/** Setzt ALLE Preise neu auf Marktwert + Aufschlag — die Schnellwahl über der Liste. */
export function applyMarkup(entries: readonly ListingEntry[], markup: number): ListingEntry[] {
  return entries.map((entry) => ({
    ...entry,
    priceText: formatCurrencyInput(priceWithMarkup(entry.marketValue, markup)),
  }));
}

export function setEntryPrice(
  entries: readonly ListingEntry[],
  playerId: string,
  priceText: string,
): ListingEntry[] {
  return entries.map((entry) => (entry.playerId === playerId ? { ...entry, priceText } : entry));
}

/** Schon gelistete Einträge lassen sich nicht auswählen — siehe `alreadyListed`. */
export function toggleEntry(entries: readonly ListingEntry[], playerId: string): ListingEntry[] {
  return entries.map((entry) =>
    entry.playerId === playerId && !entry.alreadyListed
      ? { ...entry, selected: !entry.selected }
      : entry,
  );
}

export interface ListingTotals {
  /** Ausgewählte Spieler. */
  count: number;
  /** Summe der eingetragenen Angebotspreise — der Erlös, WENN alle zu diesem Preis weggehen. */
  proceeds: number;
  /** Kontostand danach. */
  balanceAfter: number;
  /** Was dann noch zum Ausgleich auf 0 fehlt; 0, sobald das Konto gedeckt ist. */
  shortfall: number;
  /** true, wenn der Kontostand danach nicht mehr negativ ist. */
  covers: boolean;
}

/** `budget` ist der aktuelle Kontostand (bei Pflichtverkäufen also negativ). */
export function listingTotals(entries: readonly ListingEntry[], budget: number): ListingTotals {
  const selected = entries.filter((entry) => entry.selected);
  const proceeds = selected.reduce((sum, entry) => sum + (parseCurrencyInput(entry.priceText) ?? 0), 0);
  const balanceAfter = budget + proceeds;
  return {
    count: selected.length,
    proceeds,
    balanceAfter,
    shortfall: Math.max(0, -balanceAfter),
    covers: balanceAfter >= 0,
  };
}

/**
 * Clientseitige Vorprüfung. Alles darüber hinaus (Mindestpreis, gesperrter
 * Spieler, laufender Spieltag) meldet die Kickbase-API selbst über `errMsg`,
 * siehe KickbaseError in api/kickbase/client.ts — genau wie bei validateOffer.
 */
export function validateListing(entries: readonly ListingEntry[]): string | null {
  const selected = entries.filter((entry) => entry.selected);
  if (selected.length === 0) return 'Keinen Spieler ausgewählt.';
  const withoutPrice = selected.filter((entry) => {
    const price = parseCurrencyInput(entry.priceText);
    return price === null || price <= 0;
  });
  if (withoutPrice.length > 0) {
    return `Preis fehlt für ${withoutPrice.map((entry) => entry.name).join(', ')}.`;
  }
  return null;
}

/**
 * Die abzuschickenden Listings — nur gültige, in der Reihenfolge der Liste.
 * Aufrufen erst, wenn `validateListing` null liefert; ungültige Preise fallen
 * hier vorsorglich heraus, statt als 0 an die API zu gehen.
 */
export function selectedListings(entries: readonly ListingEntry[]): ListPlayerInput[] {
  return entries.flatMap((entry) => {
    if (!entry.selected) return [];
    const price = parseCurrencyInput(entry.priceText);
    if (price === null || price <= 0) return [];
    return [{ playerId: entry.playerId, price }];
  });
}

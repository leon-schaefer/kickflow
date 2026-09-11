/**
 * „Was soll ich für diesen Spieler bieten?" — die Preisseite der
 * Kaufempfehlung (siehe utils/replacementAdvice.ts, das diese Funktion für
 * jeden Marktkandidaten aufruft).
 *
 * Zwei Größen, die nicht verwechselt werden dürfen:
 *
 *   1. Was ein Gebot BRAUCHT, um überhaupt eine Chance zu haben. Das hängt am
 *      Listing: bei einem Kickbase-Listing gewinnt am Ende das höchste Gebot,
 *      bei einem Manager-Listing entscheidet ein Mensch, der den Marktwert
 *      genauso sieht wie ich. Beides treibt den Preis NACH OBEN und ist der
 *      Grund für einen Aufschlag.
 *   2. Was der Spieler WERT ist. Das hängt an meinem Kader: ein Zukauf, der
 *      pro Million weniger Punkte liefert als meine Elf im Median, verwässert
 *      sie — egal wie gut er absolut ist. Das ist die Obergrenze (`ceiling`).
 *
 * Zwischen beiden liegt der Verhandlungsraum. Liegt der nötige Preis über der
 * Obergrenze, gibt es keinen — dann bleibt die Empfehlung stehen, trägt aber
 * das Urteil 'ueber-wert'. Bewusst kein Verbot: der Spieler kann trotzdem der
 * größte Punktzugewinn sein, und ein Ausfall am Spieltag kostet Punkte, die
 * kein Effizienzargument zurückholt. Die Entscheidung bleibt beim Nutzer, die
 * Zahl daneben sagt ihm, was sie kostet.
 *
 * Die Aufschläge unten sind AUGENMASS, kein kalibriertes Modell — dieselbe
 * bewusst grobe Sorte wie `difficultyFactor` in fixtureDifficulty.ts. Sie
 * stehen als benannte Konstanten da, damit man sie ansehen und ändern kann,
 * statt sie aus einer Formel zu lesen.
 */
import { formatCurrency } from './format';

/** Grundaufschlag auf die Wettbewerbs-Untergrenze, je Verkäufertyp. */
const BASE_MARKUP_BOT = 0.03;
const BASE_MARKUP_MANAGER = 0.07;
/** Jedes sichtbare Gebot ist ein Mitbieter, der schon mehr als den Startpreis will. */
const MARKUP_PER_OFFER = 0.03;
const MAX_OFFER_MARKUP = 0.09;
/** Kurz vor Ablauf gibt es kein Nachbessern mehr — das letzte Gebot muss sitzen. */
const MARKUP_EXPIRING_SOON = 0.02;
const EXPIRING_SOON_SECONDS = 60 * 60;

/** Empfohlene Gebote werden auf ganze Tausender aufgerundet — eine glatte Zahl liest sich als Entscheidung, nicht als Rechenergebnis. */
const BID_ROUNDING = 1_000;

export type BidVerdict =
  /** Gebot liegt im Rahmen und unter der Wertobergrenze. */
  | 'bieten'
  /** Nötiger Preis über der Wertobergrenze — machbar, aber teuer erkauft. */
  | 'ueber-wert'
  /** Der 33%-Rahmen deckt nicht einmal den Angebotspreis. */
  | 'kein-budget';

/** Kurzform für die Pille an der Zeile — Vorbild `recommendationLabels` in sellAdvice.ts. */
export const bidVerdictLabels: Record<BidVerdict, string> = {
  // „Empfohlen" und nicht „Bieten": in der Zeile steht direkt daneben der
  // Knopf, der so heißt (siehe BuyAdviceRow) — zweimal dasselbe Wort
  // nebeneinander liest sich wie zwei Knöpfe.
  bieten: 'Empfohlen',
  'ueber-wert': 'Über Wert',
  'kein-budget': 'Kein Budget',
};

export interface BidAdviceInput {
  /** Angebotspreis des Verkäufers (`MarketPlayer.price`) — das Mindestgebot. */
  price: number;
  marketValue: number;
  /**
   * Für mich sichtbare Gebote (`MarketPlayer.offerCount`) — INKLUSIVE meines
   * eigenen, falls ich schon geboten habe: Kickbase zählt es in `ofc` mit
   * (siehe `placeOffer` in endpoints.ts, „`ofc` bleibt 1").
   */
  offerCount: number;
  /**
   * Mein eigenes Gebot auf dieses Listing (`MarketPlayer.ownOfferPrice`),
   * `null` ohne. Ohne dieses Feld hielte sich die Empfehlung selbst für einen
   * Mitbieter und legte nach jedem eigenen Gebot noch einmal drauf — genau
   * das Rätsel „ich habe geboten, jetzt empfiehlt sie mehr".
   */
  ownOfferPrice: number | null;
  /** true = Kickbase verkauft, kein Manager (`MarketPlayer.isBotListing`). */
  isBotListing: boolean;
  /** Restlaufzeit; `null` bei Manager-Listings, die nie ablaufen. */
  expiresInSeconds: number | null;
  /** Ø-Punkte des Spielers — Zähler der Wertobergrenze. */
  averagePoints: number;
  /**
   * Ø-Punkte je Mio, die der eigene Kader im Median liefert (siehe
   * replacementAdvice.ts). 0 = keine Referenz, dann gibt es keine Obergrenze.
   */
  referenceValueScore: number;
  /**
   * Spielraum für ein Gebot auf DIESEN Spieler: inkl. 33%-Überziehungsrahmen,
   * abzüglich offener Gebote auf andere Spieler, ein eigenes Gebot auf diesen
   * schon wieder freigegeben (`availableForRebid`, siehe utils/budget.ts).
   * `null` = noch nicht bekannt; dann wird nicht gedeckelt, statt ein Gebot
   * zu verbieten, das erlaubt sein könnte.
   */
  available: number | null;
}

export interface BidAdvice {
  /**
   * Empfohlenes Gebot in Euro. `null` nur bei 'kein-budget' — sonst steht
   * immer eine Zahl da, notfalls die vom Budget gedeckelte.
   */
  bid: number | null;
  /** Mindestgebot, das Kickbase annimmt: der Angebotspreis. */
  minBid: number;
  /**
   * Untergrenze, ab der ein Gebot im Wettbewerb überhaupt eine Chance hat:
   * max(Angebotspreis, Marktwert). Ein Listing unter Marktwert ist ein
   * Schnäppchen, das alle sehen — dort ist der Angebotspreis keine
   * realistische Zuschlagsgrenze.
   */
  competitiveBid: number;
  /** Aufschlag auf `competitiveBid` in ganzen Prozent (0, wenn keiner nötig ist). */
  markupPercent: number;
  /** Gebote ANDERER auf dieses Listing — `offerCount` ohne mein eigenes. */
  competitorCount: number;
  /** Preis, ab dem der Zukauf die Kader-Effizienz verwässert. `null` ohne Referenz. */
  ceiling: number | null;
  /** true, wenn das Budget das Gebot unter den empfohlenen Wert drückt. */
  cappedByBudget: boolean;
  verdict: BidVerdict;
  /** Ein Satz auf Deutsch, direkt anzeigbar. */
  reason: string;
}

/**
 * Preis, bei dem ein Spieler mit `averagePoints` genau `referenceValueScore`
 * Ø-Punkte je Mio liefert — die Umkehrung von `pointsPerMillion`
 * (utils/valueScore.ts). `null`, wenn es keine Referenz gibt (leerer Kader).
 */
export function valueCeiling(averagePoints: number, referenceValueScore: number): number | null {
  if (referenceValueScore <= 0) return null;
  return Math.round((averagePoints / referenceValueScore) * 1_000_000);
}

/**
 * Gebote, gegen die ich antrete. Mein eigenes steckt in `offerCount` mit drin
 * und ist kein Wettbewerb — es wird durch ein neues ersetzt, nicht überboten.
 */
function competitorCountFor({ offerCount, ownOfferPrice }: BidAdviceInput): number {
  return Math.max(0, offerCount - (ownOfferPrice !== null ? 1 : 0));
}

function markupFor(input: BidAdviceInput): number {
  const { isBotListing, expiresInSeconds } = input;
  const base = isBotListing ? BASE_MARKUP_BOT : BASE_MARKUP_MANAGER;
  const competition = Math.min(MAX_OFFER_MARKUP, competitorCountFor(input) * MARKUP_PER_OFFER);
  const expiring =
    expiresInSeconds !== null && expiresInSeconds <= EXPIRING_SOON_SECONDS
      ? MARKUP_EXPIRING_SOON
      : 0;
  return base + competition + expiring;
}

export function deriveBidAdvice(input: BidAdviceInput): BidAdvice {
  const { price, marketValue, isBotListing, ownOfferPrice, averagePoints, referenceValueScore, available } = input;

  const minBid = Math.max(0, price);
  const competitiveBid = Math.max(minBid, marketValue);
  const markup = markupFor(input);
  const markupPercent = Math.round(markup * 100);
  const competitorCount = competitorCountFor(input);
  const ceiling = valueCeiling(averagePoints, referenceValueScore);

  // Aufrunden auf ganze Tausender, aber nie unter die Wettbewerbs-Untergrenze —
  // bei einem Preis unter 1000 € würde ein Abrunden das Gebot ungültig machen.
  const target = Math.max(
    competitiveBid,
    Math.ceil((competitiveBid * (1 + markup)) / BID_ROUNDING) * BID_ROUNDING,
  );

  if (available !== null && available < minBid) {
    return {
      bid: null,
      minBid,
      competitiveBid,
      markupPercent,
      competitorCount,
      ceiling,
      cappedByBudget: true,
      verdict: 'kein-budget',
      reason: `Mindestgebot ${formatCurrency(minBid)}, verfügbar sind nur ${formatCurrency(available)} (inkl. 33%-Rahmen).`,
    };
  }

  const cappedByBudget = available !== null && available < target;
  const bid = cappedByBudget ? available! : target;

  const sellerNote = isBotListing
    ? 'Kickbase verkauft an das höchste Gebot'
    : 'ein Manager entscheidet über den Zuschlag';
  // Nur die Gebote der ANDEREN — das eigene ist keine Nachricht, die man sich
  // selbst überbringen müsste, und die Zeile zeigt es ohnehin (BuyAdviceRow).
  const competitionNote =
    competitorCount > 0
      ? ` · ${competitorCount} ${competitorCount === 1 ? 'Gebot liegt' : 'Gebote liegen'} bereits vor`
      : '';
  // Steht mein Gebot schon dort, wo die Empfehlung hinwill, ist der Satz
  // „X bieten" eine Aufforderung zu nichts — dann sagt er das.
  const ownOfferNote =
    ownOfferPrice !== null && ownOfferPrice >= bid
      ? ` Dein Gebot von ${formatCurrency(ownOfferPrice)} deckt das bereits.`
      : '';

  if (ceiling !== null && target > ceiling) {
    return {
      bid,
      minBid,
      competitiveBid,
      markupPercent,
      competitorCount,
      ceiling,
      cappedByBudget,
      verdict: 'ueber-wert',
      reason: `Über Wert: rechnerisch lohnt er bis ${formatCurrency(ceiling)}, für einen Zuschlag braucht es aber ${formatCurrency(target)} (${sellerNote}${competitionNote}).${ownOfferNote}`,
    };
  }

  return {
    bid,
    minBid,
    competitiveBid,
    markupPercent,
    competitorCount,
    ceiling,
    cappedByBudget,
    verdict: 'bieten',
    reason:
      (cappedByBudget
        ? `${formatCurrency(bid)} ist alles, was der 33%-Rahmen hergibt — empfohlen wären ${formatCurrency(target)} (${sellerNote}${competitionNote}).`
        : `${formatCurrency(bid)} bieten: ${formatCurrency(competitiveBid)} plus ${markupPercent} % (${sellerNote}${competitionNote}).`) +
      ownOfferNote,
  };
}

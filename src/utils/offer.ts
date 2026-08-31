/**
 * Reine Helfer für den Gebots-Dialog (OfferModal) — hält das Formular dumm,
 * damit Eingabe-Parsing und Validierung isoliert testbar bleiben.
 */

/** Parst eine Preiseingabe: alle Nicht-Ziffern raus, leer → null statt 0. */
export function parseCurrencyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return Number.parseInt(digits, 10);
}

/** Formatiert einen Preis fürs Eingabefeld: 6112964 → "6.112.964". */
export function formatCurrencyInput(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}

export interface ValidateOfferInput {
  price: number | null;
  budget: number | null;
}

/**
 * Clientseitige Vorprüfung — alles darüber hinaus (z.B. Mindestgebot,
 * abgelaufenes Listing) meldet die Kickbase-API selbst über `errMsg`
 * (siehe KickbaseError in client.ts).
 */
export function validateOffer({ price, budget }: ValidateOfferInput): string | null {
  if (price === null || price <= 0) {
    return 'Bitte ein Gebot eingeben.';
  }
  if (budget !== null && price > budget) {
    return `Budget reicht nicht: nur ${formatCurrencyInput(budget)} € verfügbar.`;
  }
  return null;
}

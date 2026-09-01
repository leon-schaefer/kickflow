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

/** Formatiert eine rohe Eingabe fürs Feld: "6112964" → "6.112.964", "" → "". */
export function formatCurrencyInputText(text: string): string {
  const value = parseCurrencyInput(text);
  return value === null ? '' : formatCurrencyInput(value);
}

export interface ValidateOfferInput {
  price: number | null;
  /** Spielraum inkl. 33%-Überziehungsrahmen und abzüglich anderer offener Gebote, siehe utils/budget.ts. */
  available: number | null;
}

/**
 * Clientseitige Vorprüfung — alles darüber hinaus (z.B. Mindestgebot,
 * abgelaufenes Listing) meldet die Kickbase-API selbst über `errMsg`
 * (siehe KickbaseError in client.ts). Geprüft wird gegen `available`, nicht
 * gegen den nackten Kontostand — ein negatives Konto ist bis zur 33%-Grenze
 * (utils/budget.ts) erlaubt.
 */
export function validateOffer({ price, available }: ValidateOfferInput): string | null {
  if (price === null || price <= 0) {
    return 'Bitte ein Gebot eingeben.';
  }
  if (available === 0) {
    return 'Dein Kader ist bereits 33 % im Minus.';
  }
  if (available !== null && price > available) {
    return `Limit erreicht: nur ${formatCurrencyInput(available)} € verfügbar (inkl. 33%-Rahmen).`;
  }
  return null;
}

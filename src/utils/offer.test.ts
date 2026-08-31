import { describe, expect, it } from 'vitest';
import { formatCurrencyInput, parseCurrencyInput, validateOffer } from './offer';

describe('parseCurrencyInput', () => {
  it('parst reine Ziffern', () => {
    expect(parseCurrencyInput('6112964')).toBe(6_112_964);
  });
  it('entfernt Tausendertrennzeichen und Währungszeichen', () => {
    expect(parseCurrencyInput('6.112.964 €')).toBe(6_112_964);
  });
  it('gibt null bei leerer Eingabe zurück', () => {
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('€')).toBeNull();
  });
});

describe('formatCurrencyInput', () => {
  it('formatiert mit deutschen Tausendertrennzeichen', () => {
    expect(formatCurrencyInput(6_112_964)).toBe('6.112.964');
  });
});

describe('validateOffer', () => {
  it('meldet einen Fehler bei fehlendem oder ungültigem Preis', () => {
    expect(validateOffer({ price: null, budget: 1_000_000 })).not.toBeNull();
    expect(validateOffer({ price: 0, budget: 1_000_000 })).not.toBeNull();
    expect(validateOffer({ price: -5, budget: 1_000_000 })).not.toBeNull();
  });
  it('meldet einen Fehler, wenn das Budget nicht reicht', () => {
    const error = validateOffer({ price: 2_000_000, budget: 1_000_000 });
    expect(error).toMatch(/Budget/);
  });
  it('lässt ein gültiges Gebot innerhalb des Budgets durch', () => {
    expect(validateOffer({ price: 500_000, budget: 1_000_000 })).toBeNull();
    expect(validateOffer({ price: 1_000_000, budget: 1_000_000 })).toBeNull();
  });
  it('validiert ohne Budgetprüfung, wenn Budget unbekannt ist', () => {
    expect(validateOffer({ price: 999_999_999, budget: null })).toBeNull();
  });
});

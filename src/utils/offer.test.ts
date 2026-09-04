import { describe, expect, it } from 'vitest';
import { formatCurrencyInput, formatCurrencyInputText, parseCurrencyInput, validateOffer } from './offer';

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

describe('formatCurrencyInputText', () => {
  it('setzt Tausenderpunkte in eine rohe Eingabe', () => {
    expect(formatCurrencyInputText('6112964')).toBe('6.112.964');
  });
  it('formatiert eine bereits formatierte Eingabe idempotent', () => {
    expect(formatCurrencyInputText('6.112.964')).toBe('6.112.964');
  });
  it('lässt ein geleertes Feld leer', () => {
    expect(formatCurrencyInputText('')).toBe('');
  });
  it('formatiert kurze Eingaben unverändert', () => {
    expect(formatCurrencyInputText('500')).toBe('500');
  });
});

describe('validateOffer', () => {
  it('meldet einen Fehler bei fehlendem oder ungültigem Preis', () => {
    expect(validateOffer({ price: null, available: 1_000_000 })).not.toBeNull();
    expect(validateOffer({ price: 0, available: 1_000_000 })).not.toBeNull();
    expect(validateOffer({ price: -5, available: 1_000_000 })).not.toBeNull();
  });
  it('meldet einen Fehler, wenn der verfügbare Spielraum nicht reicht', () => {
    const error = validateOffer({ price: 2_000_000, available: 1_000_000 });
    expect(error).toMatch(/Limit/);
  });
  it('meldet einen eigenen Hinweis, wenn der 33%-Rahmen bereits ausgeschöpft ist', () => {
    const error = validateOffer({ price: 500_000, available: 0 });
    expect(error).toMatch(/33 %/);
  });
  it('lässt ein gültiges Gebot innerhalb des verfügbaren Spielraums durch', () => {
    expect(validateOffer({ price: 500_000, available: 1_000_000 })).toBeNull();
    expect(validateOffer({ price: 1_000_000, available: 1_000_000 })).toBeNull();
  });
  it('validiert ohne Limitprüfung, wenn der Spielraum unbekannt ist', () => {
    expect(validateOffer({ price: 999_999_999, available: null })).toBeNull();
  });
});

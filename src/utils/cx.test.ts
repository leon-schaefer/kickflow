import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('fügt Klassen mit einem Leerzeichen zusammen', () => {
    expect(cx('row', 'wide')).toBe('row wide');
  });

  it('lässt Falsy-Werte weg — das Muster `cond && variant`', () => {
    expect(cx('chip', false && 'active')).toBe('chip');
    expect(cx('chip', true && 'active')).toBe('chip active');
    expect(cx('chip', null, undefined)).toBe('chip');
  });

  it('erzeugt keine führenden oder doppelten Leerzeichen', () => {
    expect(cx(false, 'row')).toBe('row');
    expect(cx(undefined, 'row', null, 'wide')).toBe('row wide');
  });

  it('ergibt ohne verwertbare Klasse den leeren String', () => {
    expect(cx()).toBe('');
    expect(cx(false, null, undefined)).toBe('');
  });
});

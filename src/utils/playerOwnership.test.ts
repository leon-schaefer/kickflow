import { describe, expect, it } from 'vitest';
import { playerOrigins } from './playerOwnership';

describe('playerOrigins', () => {
  it('markiert eigene Kaderspieler', () => {
    const origins = playerOrigins(['1', '2'], []);
    expect(origins.get('1')).toEqual({ mine: true, onMarket: false });
    expect(origins.get('2')).toEqual({ mine: true, onMarket: false });
  });

  it('markiert gelistete Spieler', () => {
    expect(playerOrigins([], ['9']).get('9')).toEqual({ mine: false, onMarket: true });
  });

  it('setzt beide Hinweise für einen selbst gelisteten eigenen Spieler', () => {
    expect(playerOrigins(['1'], ['1']).get('1')).toEqual({ mine: true, onMarket: true });
  });

  it('enthält keinen Eintrag für Spieler ohne Hinweis', () => {
    const origins = playerOrigins(['1'], ['9']);
    expect(origins.has('42')).toBe(false);
    expect(origins.size).toBe(2);
  });

  it('kommt mit leeren Listen aus', () => {
    expect(playerOrigins([], []).size).toBe(0);
  });
});

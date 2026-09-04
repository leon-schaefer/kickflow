import { describe, expect, it } from 'vitest';
import { playerOrigins, resolvePlayerOwner } from './playerOwnership';

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

describe('resolvePlayerOwner', () => {
  const emptySources = { squadPlayerIds: [], marketListings: [], managerLineups: [] };

  it('erkennt eigene Kaderspieler', () => {
    const owner = resolvePlayerOwner('1', { ...emptySources, squadPlayerIds: ['1'] });
    expect(owner).toEqual({ kind: 'me', name: null, userId: null, onMarket: false });
  });

  it('nennt den Verkäufer eines Manager-Listings als Besitzer', () => {
    const owner = resolvePlayerOwner('1', {
      ...emptySources,
      marketListings: [{ playerId: '1', sellerName: 'Jonas', sellerId: '42' }],
    });
    expect(owner).toEqual({ kind: 'manager', name: 'Jonas', userId: '42', onMarket: true });
  });

  it('wertet ein Kickbase-Listing ohne Verkäufer als besitzerlos', () => {
    const owner = resolvePlayerOwner('1', {
      ...emptySources,
      marketListings: [{ playerId: '1', sellerName: null, sellerId: null }],
    });
    expect(owner).toEqual({ kind: 'free', name: null, userId: null, onMarket: true });
  });

  it('holt den fehlenden Verkäufernamen über die Rangliste nach', () => {
    const owner = resolvePlayerOwner('1', {
      ...emptySources,
      marketListings: [{ playerId: '1', sellerName: null, sellerId: '42' }],
      managerLineups: [{ userId: '42', userName: 'Jonas', lineupPlayerIds: [] }],
    });
    expect(owner).toMatchObject({ kind: 'manager', name: 'Jonas', userId: '42' });
  });

  it('erkennt den Besitzer an der Startelf eines Managers', () => {
    const owner = resolvePlayerOwner('7', {
      ...emptySources,
      managerLineups: [
        { userId: '1', userName: 'Anna', lineupPlayerIds: ['3', null, '4'] },
        { userId: '2', userName: 'Jonas', lineupPlayerIds: ['7', '8'] },
      ],
    });
    expect(owner).toEqual({ kind: 'manager', name: 'Jonas', userId: '2', onMarket: false });
  });

  it('bleibt bei „unbekannt“, wenn keine Quelle greift — nicht bei „frei“', () => {
    const owner = resolvePlayerOwner('99', {
      ...emptySources,
      squadPlayerIds: ['1'],
      managerLineups: [{ userId: '2', userName: 'Jonas', lineupPlayerIds: ['7'] }],
    });
    expect(owner.kind).toBe('unknown');
  });

  it('bleibt bei einem selbst gelisteten Spieler „mein Kader“ und meldet den Markt', () => {
    const owner = resolvePlayerOwner('1', {
      ...emptySources,
      squadPlayerIds: ['1'],
      marketListings: [{ playerId: '1', sellerName: 'Leon', sellerId: '9' }],
    });
    expect(owner).toEqual({ kind: 'me', name: null, userId: null, onMarket: true });
  });

  it('zieht das Listing der Startelf vor (verkaufter Spieler steht noch in der alten Elf)', () => {
    const owner = resolvePlayerOwner('7', {
      ...emptySources,
      marketListings: [{ playerId: '7', sellerName: 'Neu', sellerId: '5' }],
      managerLineups: [{ userId: '2', userName: 'Alt', lineupPlayerIds: ['7'] }],
    });
    expect(owner).toMatchObject({ kind: 'manager', name: 'Neu', userId: '5' });
  });
});

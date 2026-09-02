import { describe, expect, it } from 'vitest';
import { focusedLeagueTabTitle } from './leagueTabs';

describe('focusedLeagueTabTitle', () => {
  it('liefert den Titel des fokussierten Tabs (squad)', () => {
    const state = {
      routes: [
        {
          name: '(tabs)',
          state: {
            index: 1,
            routes: [{ name: 'lineup' }, { name: 'squad' }, { name: 'value' }],
          },
        },
        { name: 'player/[playerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Kader');
  });

  it('liefert den Titel des fokussierten Tabs (value)', () => {
    const state = {
      routes: [
        {
          name: '(tabs)',
          state: {
            index: 2,
            routes: [{ name: 'lineup' }, { name: 'squad' }, { name: 'value' }],
          },
        },
        { name: 'player/[playerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Wert');
  });

  it('fällt auf „Aufstellung“ zurück, wenn `(tabs)` keinen State hat', () => {
    const state = {
      routes: [{ name: '(tabs)' }, { name: 'player/[playerId]' }],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Aufstellung');
  });

  it('fällt auf „Aufstellung“ zurück, wenn der State fehlt (Deep Link)', () => {
    expect(focusedLeagueTabTitle(undefined)).toBe('Aufstellung');
  });

  it('nimmt bei fehlendem `index` (PartialState) den letzten Eintrag aus `routes`', () => {
    const state = {
      routes: [
        {
          name: '(tabs)',
          state: {
            routes: [{ name: 'lineup' }, { name: 'squad' }],
          },
        },
        { name: 'player/[playerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Kader');
  });
});

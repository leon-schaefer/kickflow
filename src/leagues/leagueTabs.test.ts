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

  it('nimmt den Titel des Screens unter dem obersten (Manager-Ansicht statt Tab)', () => {
    const state = {
      routes: [
        {
          name: '(tabs)',
          state: {
            index: 3,
            routes: [{ name: 'lineup' }, { name: 'squad' }, { name: 'value' }, { name: 'league' }],
          },
        },
        { name: 'manager/[managerId]' },
        { name: 'player/[playerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Manager');
  });

  it('liefert für die Manager-Ansicht selbst den Titel des Liga-Tabs', () => {
    const state = {
      routes: [
        {
          name: '(tabs)',
          state: {
            index: 3,
            routes: [{ name: 'lineup' }, { name: 'squad' }, { name: 'value' }, { name: 'league' }],
          },
        },
        { name: 'manager/[managerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Liga');
  });

  it('respektiert einen expliziten `index` des Stacks (oberster Screen ist nicht der letzte)', () => {
    const state = {
      index: 1,
      routes: [
        { name: '(tabs)', state: { index: 1, routes: [{ name: 'lineup' }, { name: 'squad' }] } },
        { name: 'manager/[managerId]' },
        { name: 'player/[playerId]' },
      ],
    };
    expect(focusedLeagueTabTitle(state)).toBe('Kader');
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

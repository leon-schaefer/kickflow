import { describe, expect, it } from 'vitest';
import { leagueTabTitleForPath } from './leagueTabs';

describe('leagueTabTitleForPath', () => {
  it.each([
    ['/42/lineup', 'Aufstellung'],
    ['/42/market', 'Markt'],
    ['/42/more', 'Mehr'],
  ])('benennt den Tab von %s', (pathname, title) => {
    expect(leagueTabTitleForPath(pathname)).toBe(title);
  });

  it.each([
    ['ein Detail über den Tabs', '/42/player/99'],
    ['ein Pfad ohne Liga', '/settings'],
    ['die Wurzel', '/'],
  ])('liefert null außerhalb der Tabs (%s)', (_name, pathname) => {
    expect(leagueTabTitleForPath(pathname)).toBeNull();
  });

  // `split('/')[2]` trifft sonst auf das Prototyp-Objekt: `'toString' in obj`
  // ist true, `leagueTabTitles['toString']` eine Funktion.
  it('lässt sich nicht von geerbten Eigenschaften täuschen', () => {
    expect(leagueTabTitleForPath('/42/toString')).toBeNull();
  });
});

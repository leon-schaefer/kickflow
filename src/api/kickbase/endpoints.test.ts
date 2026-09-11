/**
 * Tests für die Marktschreib-Endpoints. Sie prüfen genau das, was an einem
 * dünnen fetch-Wrapper überhaupt brechen kann und dem Aufrufer nie auffällt:
 * Pfad, Methode und FELDNAMEN des Bodys.
 *
 * Anlass ist ein echter Fehler — der Dialog „Auf den Markt stellen" schickte
 * `{ playerId, price }` und bekam von Kickbase auf jede Zeile `NotFound`,
 * weil der Endpoint `pi`/`prc` erwartet (siehe listPlayerOnMarket).
 * Ein Mapper-Test hätte das nie gesehen: die Antwort wird hier nicht gelesen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KickbaseError } from './client';
import { getLeagueRanking, getLeagueRankingAtMatchday, listPlayerOnMarket, placeOffer } from './endpoints';

interface Call {
  url: string;
  method: string | undefined;
  body: unknown;
}

/**
 * Ersetzt `fetch` und protokolliert die Requests. `statuses` ist die Folge der
 * Antwort-Status je Aufruf; der letzte Wert gilt für alle weiteren.
 */
function stubFetch(statuses: number[] = [200], errMsg = 'NotFound') {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const status = statuses[Math.min(calls.length, statuses.length - 1)];
    calls.push({
      url,
      method: init?.method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    return Promise.resolve(
      new Response(status === 200 ? '{}' : JSON.stringify({ errMsg }), { status }),
    );
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listPlayerOnMarket', () => {
  it('schickt die kurzen Feldnamen pi/prc an POST /market/', async () => {
    const calls = stubFetch();

    await listPlayerOnMarket('token', 'league-1', { playerId: '4242', price: 6_112_964 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.kickbase.com/v4/leagues/league-1/market/');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toMatchObject({ pi: '4242', prc: 6_112_964 });
  });

  it('schickt zusätzlich die langen Feldnamen, weil die Quellen sich widersprechen', async () => {
    const calls = stubFetch();

    await listPlayerOnMarket('token', 'league-1', { playerId: '4242', price: 6_112_964 });

    expect(calls[0].body).toMatchObject({ playerId: '4242', price: 6_112_964 });
  });

  it('versucht bei 404 denselben Request ohne abschließenden Slash', async () => {
    const calls = stubFetch([404, 200]);

    await listPlayerOnMarket('token', 'league-1', { playerId: '4242', price: 1_000_000 });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.kickbase.com/v4/leagues/league-1/market/',
      'https://api.kickbase.com/v4/leagues/league-1/market',
    ]);
    expect(calls[1].body).toMatchObject({ pi: '4242', prc: 1_000_000 });
  });

  it('meldet den Fehler des Zweitversuchs, wenn auch der Pfad ohne Slash 404 liefert', async () => {
    stubFetch([404, 404], 'NotFound');

    await expect(
      listPlayerOnMarket('token', 'league-1', { playerId: '4242', price: 1_000_000 }),
    ).rejects.toThrow('NotFound');
  });

  it('wiederholt NICHT, wenn die API den Preis ablehnt (400)', async () => {
    const calls = stubFetch([400], 'Preis zu niedrig');

    await expect(
      listPlayerOnMarket('token', 'league-1', { playerId: '4242', price: 1 }),
    ).rejects.toThrow(KickbaseError);
    expect(calls).toHaveLength(1);
  });
});

describe('placeOffer', () => {
  /**
   * Der Gegenbeweis zur Regel oben: der Gebots-Endpoint nimmt `price` — das
   * ist gegen ein echtes Konto gemessen (siehe placeOffer) und darf beim
   * „Aufräumen" nicht auf `prc` mitgezogen werden.
   */
  it('schickt price an POST /market/{playerId}/offers', async () => {
    const calls = stubFetch();

    await placeOffer('token', 'league-1', { playerId: '4242', price: 500_000 });

    expect(calls[0].url).toBe('https://api.kickbase.com/v4/leagues/league-1/market/4242/offers');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ price: 500_000 });
  });
});

/**
 * Der `dayNumber`-Parameter ist der ganze Unterschied zwischen „Stand der
 * Saison" und „Elf GENAU dieses Spieltags" (siehe getLeagueRanking) — und die
 * Punkte-Statistik hängt daran: ohne ihn rechnet sie jeden Spieltag gegen
 * dieselbe, zuletzt abgerechnete Elf.
 */
describe('getLeagueRanking / getLeagueRankingAtMatchday', () => {
  it('fragt die Saisonwertung ohne dayNumber ab', async () => {
    const calls = stubFetch();

    await getLeagueRanking('token', 'league-1');

    expect(calls[0].url).toBe('https://api.kickbase.com/v4/leagues/league-1/ranking');
  });

  it('hängt den Spieltag als dayNumber an', async () => {
    const calls = stubFetch();

    await getLeagueRankingAtMatchday('token', 'league-1', 7);

    expect(calls[0].url).toBe('https://api.kickbase.com/v4/leagues/league-1/ranking?dayNumber=7');
  });
});

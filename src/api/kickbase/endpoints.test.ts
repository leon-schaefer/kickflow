import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests für `listPlayerOnMarket` — den einzigen Aufruf mit mehreren
 * Pfad-Kandidaten (siehe LISTING_PATHS in endpoints.ts).
 *
 * Jeder Test importiert das Modul frisch: der gemerkte Pfad
 * (`knownListingPath`) ist Modulzustand und würde sonst aus dem vorherigen
 * Test in den nächsten lecken — genau das, was Test 3 gezielt prüft.
 */
async function freshEndpoints() {
  vi.resetModules();
  return import('./endpoints');
}

/** Antwort-Attrappe für kbFetch: liest nur `ok`, `status` und `text()`. */
function respond(status: number, body: unknown = null): Response {
  return new Response(body === null ? '' : JSON.stringify(body), { status });
}

function stubFetch(...responses: Response[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
    const next = responses.shift();
    if (!next) throw new Error(`Unerwartete Anfrage an ${url}`);
    return Promise.resolve(next);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listPlayerOnMarket', () => {
  it('stellt den Spieler über den ersten Kandidaten ein', async () => {
    const calls = stubFetch(respond(200, {}));
    const { listPlayerOnMarket } = await freshEndpoints();

    await listPlayerOnMarket('tkn', 'L1', { playerId: '118', price: 3_000_000 });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.kickbase.com/v4/leagues/L1/market/118');
    expect(calls[0]!.body).toEqual({ playerId: '118', price: 3_000_000 });
  });

  it('probiert nach einem 404 den nächsten Pfad', async () => {
    const calls = stubFetch(respond(404, { errMsg: 'NotFound' }), respond(200, {}));
    const { listPlayerOnMarket } = await freshEndpoints();

    await listPlayerOnMarket('tkn', 'L1', { playerId: '118', price: 3_000_000 });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.kickbase.com/v4/leagues/L1/market/118',
      'https://api.kickbase.com/v4/leagues/L1/market/',
    ]);
  });

  it('merkt sich den Treffer und probiert beim nächsten Spieler nicht neu', async () => {
    const calls = stubFetch(respond(404, { errMsg: 'NotFound' }), respond(200, {}), respond(200, {}));
    const { listPlayerOnMarket } = await freshEndpoints();

    await listPlayerOnMarket('tkn', 'L1', { playerId: '118', price: 3_000_000 });
    await listPlayerOnMarket('tkn', 'L1', { playerId: '119', price: 4_000_000 });

    expect(calls).toHaveLength(3);
    expect(calls[2]!.url).toBe('https://api.kickbase.com/v4/leagues/L1/market/');
    expect(calls[2]!.body).toEqual({ playerId: '119', price: 4_000_000 });
  });

  it('reicht eine Ablehnung ≠ 404 unverändert durch, ohne weiterzuprobieren', async () => {
    const calls = stubFetch(respond(400, { errMsg: 'Preis zu niedrig' }));
    const { listPlayerOnMarket } = await freshEndpoints();

    await expect(
      listPlayerOnMarket('tkn', 'L1', { playerId: '118', price: 1 }),
    ).rejects.toThrow('Preis zu niedrig');
    expect(calls).toHaveLength(1);
  });

  it('meldet nach lauter 404 die geänderte API statt Kickbases „NotFound“', async () => {
    const calls = stubFetch(
      respond(404, { errMsg: 'NotFound' }),
      respond(404, { errMsg: 'NotFound' }),
      respond(404, { errMsg: 'NotFound' }),
    );
    const { listPlayerOnMarket } = await freshEndpoints();

    await expect(
      listPlayerOnMarket('tkn', 'L1', { playerId: '118', price: 3_000_000 }),
    ).rejects.toThrow(/API hat sich geändert/);
    expect(calls).toHaveLength(3);
  });
});

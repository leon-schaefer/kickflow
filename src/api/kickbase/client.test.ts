import { afterEach, describe, expect, it, vi } from 'vitest';
import { kbFetch, KickbaseError } from './client';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('kbFetch lifecycle', () => {
  it('retains the API method, token and JSON body in direct development mode', async () => {
    vi.stubEnv('VITE_TUNNEL_URL', '');
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    await expect(kbFetch('/v4/example', { method: 'POST', token: 'synthetic', body: { value: 1 } })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://api.kickbase.com/v4/example', expect.objectContaining({
      method: 'POST', body: '{"value":1}', headers: expect.objectContaining({ Authorization: 'Bearer synthetic' }),
    }));
  });
  it('never sends an already cancelled request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const controller = new AbortController(); controller.abort();
    await expect(kbFetch('/v4/example', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the timeout active while the response body is stalled', async () => {
    vi.stubEnv('VITE_TUNNEL_URL', ''); vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream())));
    const result = expect(kbFetch('/v4/example', { timeoutMs: 100 })).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(101); await result;
  });
  it('preserves a real API authentication error', async () => {
    vi.stubEnv('VITE_TUNNEL_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"errMsg":"Not authorized"}', { status: 401 })));
    await expect(kbFetch('/v4/example')).rejects.toMatchObject({ status: 401, isUnauthorized: true, message: 'Not authorized' });
  });
  it('classifies network failures as transport errors', async () => {
    vi.stubEnv('VITE_TUNNEL_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    try { await kbFetch('/v4/example'); expect.fail('must reject'); }
    catch (error) { expect(error).toBeInstanceOf(KickbaseError); expect(error).toMatchObject({ status: 0, isUnauthorized: false }); }
  });
});

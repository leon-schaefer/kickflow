import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wasm = vi.hoisted(() => ({ initializeTunnel: vi.fn(), createTunnelSession: vi.fn() }));
vi.mock('./tunnelWasm', () => wasm);
const healthy = () => new Response('{"service":"kickflow-tunnel","protocol":"wsproxy","version":1}');
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('VITE_TUNNEL_URL', 'https://kickflow-tunnel.onrender.com');
  wasm.initializeTunnel.mockReset().mockResolvedValue(undefined);
  wasm.createTunnelSession.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('encrypted tunnel startup', () => {
  it('shares startup but one cancellation does not cancel another caller', async () => {
    const health = Promise.withResolvers<Response>();
    const fetch = vi.fn().mockReturnValue(health.promise); vi.stubGlobal('fetch', fetch);
    const { prepareTunnel } = await import('./tunnel');
    const controller = new AbortController();
    const first = expect(prepareTunnel(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const second = prepareTunnel(new AbortController().signal);
    controller.abort(); await first;
    health.resolve(healthy()); await second;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(wasm.initializeTunnel).toHaveBeenCalledTimes(1);
  });
  it('never interprets a relay 403 as a Kickbase login failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    const { kbFetch } = await import('./client');
    await expect(kbFetch('/v4/user/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 0, isUnauthorized: false });
    expect(wasm.createTunnelSession).not.toHaveBeenCalled();
  });
  it('sends only the health probe through native fetch and closes the TLS session after the body', async () => {
    const fetch = vi.fn().mockResolvedValue(healthy()); vi.stubGlobal('fetch', fetch);
    const session = { fetch: vi.fn().mockResolvedValue(new Response('{"value":42}')), close: vi.fn() };
    wasm.createTunnelSession.mockResolvedValue(session);
    const { kbFetch } = await import('./client');
    await expect(kbFetch('/v4/example', { token: 'synthetic' })).resolves.toEqual({ value: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://kickflow-tunnel.onrender.com/health');
    expect(session.fetch).toHaveBeenCalledWith('https://api.kickbase.com/v4/example', expect.objectContaining({
      redirect: 'error', credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer synthetic' }),
    }));
    expect(session.close).toHaveBeenCalledTimes(1);
  });
  it('ignores an HTML wake-up page until the actual relay is ready', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(new Response('<html>Starting</html>')).mockResolvedValue(healthy());
    vi.stubGlobal('fetch', fetch);
    const { prepareTunnel, isTunnelStarting } = await import('./tunnel');
    const ready = prepareTunnel(new AbortController().signal);
    expect(isTunnelStarting()).toBe(true);
    await vi.advanceTimersByTimeAsync(1001); await ready;
    expect(fetch).toHaveBeenCalledTimes(2); expect(isTunnelStarting()).toBe(false);
  });
  it('bounds cold-start waiting without sending the queued mutation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const { kbFetch } = await import('./client');
    const result = expect(kbFetch('/v4/example', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 0 });
    await vi.advanceTimersByTimeAsync(91_000); await result;
    expect(wasm.createTunnelSession).not.toHaveBeenCalled();
  });
  it('also bounds startup when the relay is ready but WASM loading stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthy()));
    wasm.initializeTunnel.mockReturnValue(new Promise(() => {}));
    const { kbFetch } = await import('./client');
    const result = expect(kbFetch('/v4/example')).rejects.toMatchObject({ status: 0 });
    await vi.advanceTimersByTimeAsync(90_001); await result;
    expect(wasm.createTunnelSession).not.toHaveBeenCalled();
  });
  it('does not send a cancelled mutation after shared startup completes', async () => {
    const health = Promise.withResolvers<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(health.promise));
    const { kbFetch } = await import('./client');
    const controller = new AbortController();
    const result = expect(kbFetch('/v4/example', { method: 'POST', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await result;
    health.resolve(healthy());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wasm.createTunnelSession).not.toHaveBeenCalled();
  });
  it('closes a TLS session when its response body times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthy()));
    const session = { fetch: vi.fn().mockResolvedValue(new Response(new ReadableStream())), close: vi.fn() };
    wasm.createTunnelSession.mockResolvedValue(session);
    const { kbFetch } = await import('./client');
    const result = expect(kbFetch('/v4/example', { timeoutMs: 100 })).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(101); await result;
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(session.fetch).toHaveBeenCalledTimes(1);
  });
});

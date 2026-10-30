import { parseTunnelOrigin } from './tunnelConfig';

let starting = false;
const listeners = new Set<() => void>();
let preparation: Promise<void> | undefined;
let readyUntil = 0;
export const isTunnelStarting = () => starting;
export function subscribeTunnel(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function setStarting(value: boolean) {
  starting = value;
  for (const listener of listeners) listener();
}
export function tunnelOrigin() {
  return parseTunnelOrigin(import.meta.env.VITE_TUNNEL_URL);
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Abgebrochen', 'AbortError'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

class RelayAccessError extends Error {}

async function wakeRelay(origin: string, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const response = await fetch(`${origin}/health`, {
        signal, credentials: 'omit', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer',
      });
      if (response.status === 401 || response.status === 403) {
        throw new RelayAccessError('Der Verbindungsserver hat den Zugriff abgelehnt.');
      }
      if (response.ok && await response.text() === '{"service":"kickflow-tunnel","protocol":"wsproxy","version":1}') return;
    } catch (error) {
      if (error instanceof RelayAccessError) throw error;
      // Render may answer with a wake-up HTML page, 503, or a transient network error.
    }
    if (!signal.aborted) await abortable(new Promise(resolve => setTimeout(resolve, 1_000)), signal);
  }
  throw new Error('Der Verbindungsserver startet noch oder ist nicht erreichbar. Bitte erneut versuchen.');
}

/** Shared startup has its own deadline; cancelling one caller never cancels another. */
export async function prepareTunnel(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const origin = tunnelOrigin();
  if (!origin || readyUntil > Date.now()) return;
  if (!preparation) {
    setStarting(true);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 90_000);
    preparation = abortable(Promise.all([
      wakeRelay(origin, controller.signal),
      import('./tunnelWasm').then(module => module.initializeTunnel(origin)),
    ]), controller.signal).then(() => { readyUntil = Date.now() + 30_000; }).finally(() => {
      controller.abort();
      clearTimeout(deadline);
      preparation = undefined;
      setStarting(false);
    });
  }
  await abortable(preparation, signal);
  signal.throwIfAborted();
}

export async function requestText(url: string, options: RequestInit & { signal: AbortSignal }) {
  options.signal.throwIfAborted();
  const origin = tunnelOrigin();
  if (!origin) {
    const response = await abortable(fetch(url, options), options.signal);
    return { status: response.status, ok: response.ok, text: await abortable(response.text(), options.signal) };
  }
  const target = new URL(url);
  if (target.origin !== 'https://api.kickbase.com' || target.username || target.password) throw new Error('Ungültiges Tunnel-Ziel.');
  const { createTunnelSession } = await import('./tunnelWasm');
  options.signal.throwIfAborted();
  const session = await createTunnelSession(origin);
  try {
    options.signal.throwIfAborted();
    const response = await abortable(session.fetch(url, { ...options, redirect: 'error', credentials: 'omit' }), options.signal);
    return { status: response.status, ok: response.ok, text: await abortable(response.text(), options.signal) };
  } finally { session.close(); }
}

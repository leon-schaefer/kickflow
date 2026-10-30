import moduleUrl from 'libcurl.js?url';
import wasmUrl from 'libcurl.js/libcurl.wasm?url';

type Curl = typeof import('libcurl.js')['libcurl'];
let initialization: Promise<Curl> | undefined;
export async function initializeTunnel(origin: string) {
  // ?url preserves the LGPL module unmodified as a separate, replaceable hashed asset.
  initialization ??= (async () => {
    const { libcurl }: typeof import('libcurl.js') = await import(/* @vite-ignore */ moduleUrl);
    libcurl.stdout = () => {};
    libcurl.stderr = () => {};
    libcurl.logger = () => {};
    await libcurl.load_wasm(wasmUrl);
    libcurl.transport = 'wsproxy';
    libcurl.set_websocket(`${origin.replace(/^http/, 'ws')}/tunnel/`);
    return libcurl;
  })().catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export async function createTunnelSession(origin: string) {
  const libcurl = await initializeTunnel(origin);
  // A fresh session avoids stale iOS sockets and transport-level replay on pooled connections.
  const session = new libcurl.HTTPSession({ enable_cookies: false });
  let closed = false;
  return {
    fetch: (url: string, options: RequestInit) => session.fetch(url, options),
    close() {
      if (closed) return;
      closed = true;
      // 0.7.5 leaves its polling timer alive after abort, even after freeing WASM memory.
      // Stop it before the library schedules cleanup; the shipped library stays unmodified.
      if (session.event_loop !== null) clearInterval(session.event_loop);
      session.event_loop = null;
      session.close();
    },
  };
}

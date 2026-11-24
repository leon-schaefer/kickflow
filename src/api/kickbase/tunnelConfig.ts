/** Public build configuration; no account credentials belong in this URL. */
export function parseTunnelOrigin(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Die Tunnel-Adresse ist ungültig.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Die Tunnel-Adresse muss eine HTTPS-Origin ohne Pfad oder Zugangsdaten sein.');
  }
  return url.origin;
}

export function validateTunnelCsp(value: string | undefined, csp: string): void {
  const origin = parseTunnelOrigin(value);
  if (!origin) throw new Error('VITE_TUNNEL_URL fehlt. Vor dem Produktionsbuild die Render-Adresse setzen.');
  const websocket = origin.replace(/^http/, 'ws');
  const directives = csp.split(';').map(d => d.trim().split(/\s+/));
  const connect = directives.find(d => d[0] === 'connect-src') ?? [];
  const script = directives.find(d => d[0] === 'script-src') ?? [];
  if (script.includes("'unsafe-eval'") || script.includes("'unsafe-inline'")) {
    throw new Error('Die Tunnel-CSP darf JavaScript-eval und Inline-Skripte nicht erlauben.');
  }
  if (!connect.includes(origin) || !connect.includes(websocket) || !script.includes("'wasm-unsafe-eval'")) {
    throw new Error('Tunnel-Adresse und CSP passen nicht zusammen. Die genaue HTTPS- und WSS-Origin in vercel.json freigeben.');
  }
}

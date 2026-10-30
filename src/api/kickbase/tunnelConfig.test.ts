import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTunnelOrigin, validateTunnelCsp } from './tunnelConfig';

describe('tunnel configuration', () => {
  it.each(['http://remote.example', 'https://u:p@example.com', 'https://example.com/path', 'https://example.com/?token=x', 'https://example.com/#x', 'bad'])('rejects an unsafe origin: %s', value => {
    expect(() => parseTunnelOrigin(value)).toThrow();
  });
  it('allows loopback HTTP only for local verification', () => {
    expect(parseTunnelOrigin('http://127.0.0.1:4173')).toBe('http://127.0.0.1:4173');
    expect(parseTunnelOrigin(undefined)).toBe(null);
  });
  it('requires a production origin and exact CSP grants for HTTPS and WSS', () => {
    const csp = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers[0].value;
    const origin = csp.split(/[;\s]+/).find((value: string) => value.startsWith('wss://'))?.replace(/^wss:/, 'https:');
    expect(() => validateTunnelCsp(origin, csp)).not.toThrow();
    expect(() => validateTunnelCsp(undefined, csp)).toThrow();
    expect(() => validateTunnelCsp('https://kickflow-tunnel.onrender.com', csp.replace("'wasm-unsafe-eval'", "'wasm-unsafe-eval' 'unsafe-eval'"))).toThrow();
    expect(() => validateTunnelCsp('https://unconfigured.invalid', csp)).toThrow();
    expect(() => validateTunnelCsp('https://kickflow-tunnel.onrender.com', "connect-src https://*.onrender.com wss://*.onrender.com; script-src 'self' 'wasm-unsafe-eval'")).toThrow();
  });
});

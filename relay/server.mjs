import { lookup } from 'node:dns/promises';
import { createServer } from 'node:http';
import { BlockList, connect, isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { Transform, pipeline } from 'node:stream';
import { WebSocketServer, createWebSocketStream } from 'ws';

export const TUNNEL_PATH = '/tunnel/api.kickbase.com:443';
export const HEALTH = Object.freeze({ service: 'kickflow-tunnel', protocol: 'wsproxy', version: 1 });
const HOST = 'api.kickbase.com';
const blocked = new BlockList();
for (const [ip, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(ip, bits, 'ipv4');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2001::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

/** TLS is deliberately absent here: the browser and Kickbase own the keys. */
export function createRelay({
  allowedOrigins,
  resolve = () => lookup(HOST, { all: true, verbatim: true }),
  dial = address => connect({ host: address.address, family: address.family, port: 443 }),
  maxConnections = 128,
  maxConnectionsPerIP = 24,
  maxBytes = 32 * 1024 * 1024,
  idleMs = 60_000,
  lifetimeMs = 10 * 60_000,
} = {}) {
  if (!allowedOrigins?.length) throw new Error('ALLOWED_ORIGINS muss gesetzt sein.');
  const origins = new Set(allowedOrigins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || !['https:', 'http:'].includes(url.protocol)) throw new Error('Ungültige Origin.');
    return value;
  }));
  const byIP = new Map();
  let active = 0;
  let dnsRequest;
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    if (origins.has(req.headers.origin)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(HEALTH));
    }
    res.writeHead(404);
    res.end();
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });
  const reject = (socket, status) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };
  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    socket.once('end', () => socket.destroy());
    if (req.url !== TUNNEL_PATH || !origins.has(req.headers.origin)) return reject(socket, '403 Forbidden');
    // Render appends the connecting address. Ignore user-supplied earlier hops.
    const forwarded = req.headers['x-forwarded-for'];
    const lastHop = typeof forwarded === 'string' ? forwarded.split(',').at(-1)?.trim() : undefined;
    const ip = lastHop && isIP(lastHop) ? lastHop : socket.remoteAddress;
    if (active >= maxConnections || (byIP.get(ip) ?? 0) >= maxConnectionsPerIP) return reject(socket, '429 Too Many Requests');
    active++;
    byIP.set(ip, (byIP.get(ip) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      const remaining = (byIP.get(ip) ?? 1) - 1;
      if (remaining) byIP.set(ip, remaining);
      else byIP.delete(ip);
    };
    socket.once('close', release);
    const dnsDeadline = setTimeout(() => socket.destroy(), 5_000);
    try {
      // One fixed target needs at most one pending lookup, even if clients disconnect.
      dnsRequest ??= Promise.resolve().then(resolve).finally(() => { dnsRequest = undefined; });
      const addresses = await dnsRequest;
      clearTimeout(dnsDeadline);
      // Connect to this validated IP, never resolve the hostname again.
      if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
        release();
        return reject(socket, '502 Bad Gateway');
      }
      if (socket.destroyed) return release();
      const address = addresses.find(a => a.family === 4) ?? addresses[0];
      wss.handleUpgrade(req, socket, head, ws => {
        const upstream = dial(address);
        const duplex = createWebSocketStream(ws);
        let bytes = 0;
        let closed = false;
        const deadline = setTimeout(() => close(), lifetimeMs);
        const close = () => {
          if (closed) return;
          closed = true;
          clearTimeout(deadline);
          upstream.destroy();
          duplex.destroy();
          ws.terminate();
          release();
        };
        const meter = () => new Transform({
          transform(chunk, _encoding, done) {
            bytes += chunk.length;
            if (bytes > maxBytes) done(new Error('Tunnel byte limit'));
            else done(null, chunk);
          },
        });
        ws.on('message', (_data, binary) => { if (!binary) close(); });
        ws.on('error', close);
        ws.on('close', close);
        upstream.setTimeout(idleMs, close);
        upstream.once('error', close);
        pipeline(duplex, meter(), upstream, close);
        pipeline(upstream, meter(), duplex, close);
      });
    } catch {
      clearTimeout(dnsDeadline);
      release();
      if (!socket.destroyed) reject(socket, '502 Bad Gateway');
    }
  });
  return {
    server,
    close() {
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
  const relay = createRelay({ allowedOrigins });
  relay.server.listen(Number(process.env.PORT ?? 10000), '0.0.0.0');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void relay.close(); });
}

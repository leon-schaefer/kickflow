import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import WebSocket from 'ws';
import { createRelay, HEALTH, isPublicAddress, TUNNEL_PATH } from './server.mjs';

const origin = 'https://www.kickflow.online';
const cleanups = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });
async function start(options = {}) {
  const relay = createRelay({ allowedOrigins: [origin], ...options });
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => relay.close());
  return `http://127.0.0.1:${relay.server.address().port}`;
}
function wsURL(base, path = TUNNEL_PATH) { return base.replace('http:', 'ws:') + path; }
async function refused(base, options = {}, path) {
  const ws = new WebSocket(wsURL(base, path), { origin, ...options });
  const [, response] = await once(ws, 'unexpected-response');
  const status = response.statusCode;
  response.resume();
  ws.terminate();
  ws.on('error', () => {});
  return status;
}

test('health identifies this protocol and grants CORS only to an allowed origin', async () => {
  const base = await start();
  const good = await fetch(base + '/health', { headers: { Origin: origin } });
  assert.deepEqual(await good.json(), HEALTH);
  assert.equal(good.headers.get('access-control-allow-origin'), origin);
  const bad = await fetch(base + '/health', { headers: { Origin: 'https://other.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(base + '/other')).status, 404);
});

test('rejects other origins, arbitrary destinations, ports and query strings before DNS', async () => {
  let resolved = 0;
  const base = await start({ resolve: async () => { resolved++; return []; } });
  assert.equal(await refused(base, { origin: 'https://other.example' }), 403);
  for (const path of ['/tunnel/example.com:443', '/tunnel/api.kickbase.com:80', TUNNEL_PATH + '?token=secret']) {
    assert.equal(await refused(base, {}, path), 403);
  }
  assert.equal(resolved, 0);
});

test('public address validation excludes loopback, private and reserved addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '100.64.1.1', '169.254.1.1', '192.168.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1', 'invalid']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('104.18.10.127'), true);
  assert.equal(isPublicAddress('2606:4700::6812:a7f'), true);
});

test('rejects DNS answers containing a private address without dialing', async () => {
  let dialed = false;
  const base = await start({ resolve: async () => [{ address: '127.0.0.1', family: 4 }], dial: () => { dialed = true; } });
  assert.equal(await refused(base), 502);
  assert.equal(dialed, false);
});

test('disconnecting clients cannot queue unbounded pending DNS lookups', async () => {
  const pending = Promise.withResolvers();
  let lookups = 0;
  const relay = createRelay({ allowedOrigins: [origin], maxConnections: 1,
    resolve: () => { lookups++; return pending.promise; } });
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => relay.close());
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const upgraded = once(relay.server, 'upgrade');
      const socket = connect({ host: '127.0.0.1', port: relay.server.address().port });
      await once(socket, 'connect');
      socket.write(`GET ${TUNNEL_PATH} HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nOrigin: ${origin}\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      const [, serverSocket] = await upgraded;
      const closed = once(serverSocket, 'close');
      socket.destroy();
      await closed;
    }
    assert.equal(lookups, 1);
  } finally { pending.resolve([]); }
});

test('forwards binary bytes unchanged using the exact validated DNS result', async () => {
  const echo = createServer(socket => socket.pipe(socket));
  await new Promise(resolve => echo.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => echo.close(resolve)));
  const address = { address: '104.18.10.127', family: 4 };
  const base = await start({ resolve: async () => [address], dial: actual => {
    assert.deepEqual(actual, address);
    return connect({ host: '127.0.0.1', port: echo.address().port });
  } });
  const ws = new WebSocket(wsURL(base), { origin });
  await once(ws, 'open');
  const bytes = Buffer.from([0x16, 0x03, 0x03, 0, 4, 0, 255, 42, 128]);
  const reply = once(ws, 'message');
  ws.send(bytes);
  assert.deepEqual((await reply)[0], bytes);
  const closed = once(ws, 'close'); ws.close(); await closed;
});

test('bounds live connections and releases a slot when a connection closes', async () => {
  const echo = createServer(socket => socket.pipe(socket));
  await new Promise(resolve => echo.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => echo.close(resolve)));
  const base = await start({ maxConnections: 1, resolve: async () => [{ address: '104.18.10.127', family: 4 }],
    dial: () => connect({ host: '127.0.0.1', port: echo.address().port }) });
  const first = new WebSocket(wsURL(base), { origin }); await once(first, 'open');
  assert.equal(await refused(base), 429);
  const closed = once(first, 'close'); first.close(); await closed;
  const next = new WebSocket(wsURL(base), { origin }); await once(next, 'open');
  const done = once(next, 'close'); next.close(); await done;
});

test('terminates a stream exceeding its byte budget', async () => {
  const echo = createServer(socket => socket.pipe(socket));
  await new Promise(resolve => echo.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise(resolve => echo.close(resolve)));
  const base = await start({ maxBytes: 4, resolve: async () => [{ address: '104.18.10.127', family: 4 }],
    dial: () => connect({ host: '127.0.0.1', port: echo.address().port }) });
  const ws = new WebSocket(wsURL(base), { origin }); await once(ws, 'open');
  const closed = once(ws, 'close'); ws.send(Buffer.alloc(8)); await closed;
});

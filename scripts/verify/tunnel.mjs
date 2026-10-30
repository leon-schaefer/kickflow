/** Real browser test of the production transport. No account or league mutations.
 * NODE_PATH=/path/to/playwright/node_modules node scripts/verify/tunnel.mjs
 * Uses a temporary Vite build and only local relay/certificate fixtures.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { connect, createServer as createTcpServer } from 'node:net';
import path from 'node:path';
import { createServer as createTlsServer } from 'node:tls';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import { createRelay } from '../../relay/server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(import.meta.dirname, '../..');
const temporary = await mkdtemp(path.join(tmpdir(), 'kickflow-tunnel-'));
const output = path.join(temporary, 'dist');
const marker = 'KICKFLOW_PUBLIC_TUNNEL_TEST_2a451';
let scenario;
let browser;
let relay;
let impostor;
let stalled;
const stalledSockets = new Set();
const csp = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers[0].value;
const web = createServer(async (req, res) => {
  try {
    const target = path.resolve(output, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(output + path.sep)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Security-Policy', csp.replace("connect-src 'self'", `connect-src 'self' ${relayOrigin} ${relayOrigin.replace('http:', 'ws:')}`));
    res.setHeader('Content-Type', target.endsWith('.wasm') ? 'application/wasm' : /\.(m?js)$/.test(target) ? 'text/javascript' : 'text/html');
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end(); }
});
let relayOrigin;
try {
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  const webOrigin = `http://127.0.0.1:${web.address().port}`;
  const key = path.join(temporary, 'key.pem'), cert = path.join(temporary, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
    '-out', cert, '-days', '1', '-subj', '/CN=api.kickbase.com',
    '-addext', 'subjectAltName=DNS:api.kickbase.com', '-addext', 'basicConstraints=critical,CA:FALSE'], { stdio: 'ignore' });
  impostor = createTlsServer({ key: await readFile(key), cert: await readFile(cert) }, socket => {
    socket.on('data', () => { scenario.impostorApplicationData = true; });
  });
  impostor.on('tlsClientError', () => {});
  await new Promise(resolve => impostor.listen(0, '127.0.0.1', resolve));
  stalled = createTcpServer(socket => {
    stalledSockets.add(socket);
    socket.on('data', () => {});
    socket.on('close', () => stalledSockets.delete(socket));
  });
  await new Promise(resolve => stalled.listen(0, '127.0.0.1', resolve));
  relay = createRelay({ allowedOrigins: [webOrigin], dial: address => {
    const current = scenario;
    const socket = connect(current.stall
      ? { host: '127.0.0.1', port: stalled.address().port }
      : current.untrusted
      ? { host: '127.0.0.1', port: impostor.address().port }
      : current.wrongHost ? { host: current.wrongHost, port: 443 }
      : { host: address.address, family: address.family, port: 443 });
    const write = socket.write.bind(socket);
    socket.write = (chunk, ...args) => { current.wire.push(Buffer.from(chunk)); return write(chunk, ...args); };
    socket.on('data', chunk => current.wire.push(Buffer.from(chunk)));
    return socket;
  } });
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  relayOrigin = `http://127.0.0.1:${relay.server.address().port}`;
  await writeFile(path.join(temporary, 'index.html'), '<!doctype html><html><body><script type="module" src="/entry.ts"></script></body></html>');
  await writeFile(path.join(temporary, 'entry.ts'), `import { kbFetch } from ${JSON.stringify(path.join(root, 'src/api/kickbase/client.ts'))};
    import { prepareTunnel } from ${JSON.stringify(path.join(root, 'src/api/kickbase/tunnel.ts'))};
    window.prepare = () => prepareTunnel(new AbortController().signal);
    window.probe = async ({timeoutMs = 12000, cancelAfter} = {}) => {
      const controller = new AbortController();
      const timer = cancelAfter ? setTimeout(() => controller.abort(), cancelAfter) : undefined;
      try { await kbFetch('/v4/user/login', {token: ${JSON.stringify(marker)}, timeoutMs, signal:controller.signal}); return {unexpectedSuccess:true}; }
      catch(e) { return {status:e.status ?? null, name:e.name, message:e.message, detail:String(e.body)}; }
      finally { clearTimeout(timer); }
    };`);
  await build({ configFile: false, root: temporary, logLevel: 'error',
    define: { 'import.meta.env.VITE_TUNNEL_URL': JSON.stringify(relayOrigin) },
    build: { outDir: output, modulePreload: { polyfill: false } },
  });
  browser = await chromium.launch();
  const cases = [{ name: 'real Kickbase', untrusted: false }, { name: 'untrusted issuer', untrusted: true }];
  // A different publicly trusted endpoint provides a separate hostname-negative test.
  const google = await lookup('www.google.com', { family: 4 });
  cases.push({ name: 'wrong hostname', wrongHost: google.address });
  cases.push({ name: 'real TLS timeout', stall: true, timeoutMs: 100 });
  cases.push({ name: 'real TLS cancellation', stall: true, cancelAfter: 100 });
  for (const options of cases) {
    scenario = { ...options, wire: [], impostorApplicationData: false };
    const page = await browser.newPage();
    const errors = [], requests = [];
    await page.addInitScript(() => { window.csp = []; addEventListener('securitypolicyviolation', e => window.csp.push(e.violatedDirective)); });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', req => requests.push(req.url()));
    await page.goto(webOrigin + '/index.html');
    await page.waitForFunction(() => typeof window.probe === 'function');
    await page.evaluate(() => window.prepare());
    const result = await page.evaluate(options => window.probe(options), options);
    // Regressions in dependency timers appear after the request has already rejected.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
    const violations = await page.evaluate(() => window.csp);
    const wire = Buffer.concat(scenario.wire);
    assert.deepEqual(violations, []);
    assert.deepEqual(errors, []);
    assert.equal(requests.some(url => new URL(url).origin === 'https://api.kickbase.com'), false);
    assert.equal(wire.includes(Buffer.from(marker)), false);
    assert.equal(wire.includes(Buffer.from('GET /v4/user/login')), false);
    assert.equal(scenario.impostorApplicationData, false);
    const expectedStatus = options.cancelAfter ? null : options.stall ? 408 : options.untrusted || options.wrongHost ? 0 : 405;
    assert.equal(result.status, expectedStatus);
    if (options.untrusted || options.wrongHost) assert.match(result.detail, /error code 60/);
    console.log(`${options.name}: PASS (HTTP status ${result.status}; no plaintext request; no CSP violation)`);
    if (options.stall) {
      assert.ok(wire.length > 0, 'The TLS request must actually be in flight before abort');
      if (options.cancelAfter) assert.equal(result.name, 'AbortError');
      scenario = { wire: [], impostorApplicationData: false };
      const next = await page.evaluate(() => window.probe());
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
      assert.equal(next.status, 405);
      assert.deepEqual(errors, [], 'Aborting one request must not corrupt the shared WASM runtime');
      console.log('  subsequent request on the same WASM instance: PASS');
    }
    await page.close();
  }
} finally {
  await browser?.close();
  await relay?.close();
  if (impostor) await new Promise(resolve => impostor.close(resolve));
  for (const socket of stalledSockets) socket.destroy();
  if (stalled) await new Promise(resolve => stalled.close(resolve));
  await new Promise(resolve => web.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}

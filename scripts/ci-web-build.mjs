import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// CI needs no deployment secrets. Exercise exactly the relay origin declared in CSP.
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const csp = config.headers.flatMap(block => block.headers).find(header => header.key === 'Content-Security-Policy')?.value ?? '';
const connect = csp.split(';').find(directive => directive.trim().startsWith('connect-src ')) ?? '';
const origins = connect.trim().split(/\s+/).filter(source => source.startsWith('wss://'));
if (origins.length !== 1) throw new Error('CI benötigt genau eine explizite WSS-Relay-Origin.');
const result = spawnSync('npm', ['run', 'build:web'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_TUNNEL_URL: origins[0].replace(/^wss:/, 'https:') },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

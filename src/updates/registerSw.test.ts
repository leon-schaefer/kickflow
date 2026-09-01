import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { formatBuildId } from './buildId';

/**
 * Testet das echte, ausgelieferte public/register-sw.js — nicht eine Kopie
 * seiner Logik. Die Datei ist plain Browser-JS ohne Module-Exports, also wird
 * sie hier mit gestubbtem window/document/fetch ausgeführt. Ein Formatwechsel
 * in buildId.ts oder ein Umbau des Checks fliegt damit im Test auf, statt
 * still in Produktion den Update-Hinweis abzuschalten.
 */
const SOURCE = readFileSync(
  path.join(import.meta.dirname, '..', '..', 'public', 'register-sw.js'),
  'utf-8',
);

const NOW = Date.parse('2026-09-01T18:42:27Z');
const CURRENT = formatBuildId(NOW, 'bc0c043');
const NEXT_DEPLOY = formatBuildId(NOW + 3_600_000, 'bc0c043'); // gleicher Commit, neuer Build

type Response = { ok: boolean; body: string };

function ok(body: string): Response {
  return { ok: true, body };
}

function loadRegisterSw(respond: () => Response | null) {
  const window = new EventTarget() as EventTarget & { addEventListener: EventTarget['addEventListener'] };
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const warnings: string[] = [];
  let intervalFn: (() => void) | null = null;

  const fetchMock = vi.fn(() => {
    const response = respond();
    // `null` = Netzwerkfehler (offline) — fetch rejected.
    if (!response) return Promise.reject(new Error('offline'));
    return Promise.resolve({
      ok: response.ok,
      text: () => Promise.resolve(response.body),
    });
  });

  const run = new Function(
    'navigator',
    'window',
    'document',
    'fetch',
    'setInterval',
    'clearInterval',
    'console',
    SOURCE,
  );
  run(
    {}, // kein serviceWorker im Stub — die Registrierung selbst ist hier nicht der Testgegenstand
    window,
    document,
    fetchMock,
    (fn: () => void) => {
      intervalFn = fn;
      return 1;
    },
    () => {
      intervalFn = null;
    },
    { warn: (msg: string) => warnings.push(msg) },
  );

  const updates: string[] = [];
  window.addEventListener('kickflow:update-available', () => updates.push('update'));
  window.dispatchEvent(new Event('load'));

  return {
    updates,
    warnings,
    fetchMock,
    /** Wartet die Promise-Kette in checkForUpdate ab. */
    flush: () => new Promise((resolve) => setImmediate(resolve)),
    tickInterval: () => intervalFn?.(),
    intervalStopped: () => intervalFn === null,
    becomeVisible: () => document.dispatchEvent(new Event('visibilitychange')),
  };
}

describe('register-sw.js Update-Check', () => {
  it('meldet nichts, solange die Build-ID gleich bleibt', async () => {
    const sw = loadRegisterSw(() => ok(CURRENT));
    await sw.flush();
    expect(sw.updates).toEqual([]); // erster Fetch setzt nur die Baseline

    sw.tickInterval();
    await sw.flush();
    expect(sw.updates).toEqual([]);
  });

  it('meldet ein Update, wenn derselbe Commit neu deployed wurde', async () => {
    let current = CURRENT;
    const sw = loadRegisterSw(() => ok(current));
    await sw.flush();

    current = NEXT_DEPLOY;
    sw.tickInterval();
    await sw.flush();

    expect(sw.updates).toEqual(['update']);
    // Danach still: der Banner steht, weitere Checks bringen nichts.
    expect(sw.intervalStopped()).toBe(true);
    const callsAfterUpdate = sw.fetchMock.mock.calls.length;
    sw.becomeVisible();
    await sw.flush();
    expect(sw.fetchMock.mock.calls.length).toBe(callsAfterUpdate);
  });

  it('prüft beim Wechsel in den Vordergrund erneut', async () => {
    let current = CURRENT;
    const sw = loadRegisterSw(() => ok(current));
    await sw.flush();

    current = NEXT_DEPLOY;
    sw.becomeVisible();
    await sw.flush();

    expect(sw.updates).toEqual(['update']);
  });

  it('setzt die Baseline erst beim ersten erfolgreichen Fetch', async () => {
    let online = false;
    const sw = loadRegisterSw(() => (online ? ok(CURRENT) : null));
    await sw.flush();
    expect(sw.updates).toEqual([]);

    // Erst jetzt kommt eine Antwort — sie ist die Baseline, kein Update.
    online = true;
    sw.tickInterval();
    await sw.flush();
    expect(sw.updates).toEqual([]);

    sw.tickInterval();
    await sw.flush();
    expect(sw.updates).toEqual([]);
  });

  // Der Fall, den die Formatprüfung abfängt: fehlt build-id.txt im Deploy,
  // beantwortet der SPA-Rewrite aus vercel.json den Request mit index.html
  // und Status 200. Ohne Prüfung würde die HTML-Seite als Build-ID gelten.
  it('behandelt eine per SPA-Rewrite ausgelieferte index.html als Fehlschlag', async () => {
    const html = '<!DOCTYPE html><html><head><title>kickflow</title></head><body></body></html>';
    const sw = loadRegisterSw(() => ok(html));
    await sw.flush();
    sw.tickInterval();
    await sw.flush();
    sw.tickInterval();
    await sw.flush();

    expect(sw.updates).toEqual([]);
    expect(sw.warnings).toHaveLength(1);
    expect(sw.warnings[0]).toContain('build-id.txt');
  });

  it('warnt erst nach drei Fehlschlägen und nur einmal', async () => {
    let online = false;
    const sw = loadRegisterSw(() => (online ? ok(CURRENT) : null));
    await sw.flush();
    sw.tickInterval();
    await sw.flush();
    expect(sw.warnings).toEqual([]);

    sw.tickInterval();
    await sw.flush();
    expect(sw.warnings).toHaveLength(1);

    sw.tickInterval();
    await sw.flush();
    expect(sw.warnings).toHaveLength(1);

    // Nach einer erfolgreichen Antwort zählt der Zähler wieder von vorn.
    online = true;
    sw.tickInterval();
    await sw.flush();
    expect(sw.updates).toEqual([]);
  });

  it('meldet kein Update, wenn der Server mit einem Fehlerstatus antwortet', async () => {
    let current: Response = ok(CURRENT);
    const sw = loadRegisterSw(() => current);
    await sw.flush();

    current = { ok: false, body: 'Not Found' };
    sw.tickInterval();
    await sw.flush();

    expect(sw.updates).toEqual([]);
  });
});

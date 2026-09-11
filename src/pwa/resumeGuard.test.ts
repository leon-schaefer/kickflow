import { describe, expect, it, vi } from 'vitest';
import {
  messageChannelProbe,
  startResumeGuard,
  type ResumeGuardDocument,
  type ResumeGuardWindow,
} from './resumeGuard';

/**
 * Der Wächter ist gegen einen Zustand gebaut, den kein Test herstellen kann:
 * einen `MessageChannel`, den iOS nach dem Auftauen der Seite nicht mehr
 * bedient. Genau deshalb liegt die Sonde als Parameter außen — hier wird sie
 * durch eine ersetzt, die auf Kommando zurückkommt oder eben nie.
 *
 * Ohne DOM (Node-Projekt, siehe vite.config.ts) und mit einer Uhr, die der
 * Test selbst stellt: der interessante Teil ist die Zeit im Hintergrund, und
 * die soll keine echte Sekunde kosten.
 */
function createTarget() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    visibilityState: 'visible',
    addEventListener(type: string, listener: (event: unknown) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (event: unknown) => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, event: unknown = {}) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

type Target = ReturnType<typeof createTarget>;

interface Harness {
  doc: Target;
  win: Target;
  onStalled: () => void;
  onRecovered: () => void;
  /** Löst die offene Sonde aus — das „React rendert wieder"-Signal. */
  drain: () => void;
  tick: (ms: number) => void;
  stop: () => void;
}

function setup(options: { drainImmediately?: boolean } = {}): Harness {
  const doc = createTarget();
  const win = createTarget();
  const onStalled = vi.fn();
  const onRecovered = vi.fn();
  let clock = 1_000_000;
  let pending: (() => void) | null = null;

  const stop = startResumeGuard({
    doc: doc as unknown as ResumeGuardDocument,
    win: win as unknown as ResumeGuardWindow,
    now: () => clock,
    probe: (onDrained) => {
      if (options.drainImmediately) onDrained();
      else pending = onDrained;
    },
    onStalled,
    onRecovered,
  });

  return {
    doc,
    win,
    onStalled,
    onRecovered,
    drain: () => {
      const drained = pending;
      pending = null;
      drained?.();
    },
    tick: (ms) => {
      clock += ms;
    },
    stop,
  };
}

/** Ab in den Hintergrund und nach `ms` zurück. */
function background(h: Harness, ms: number): void {
  h.doc.visibilityState = 'hidden';
  h.doc.emit('visibilitychange');
  h.tick(ms);
  h.doc.visibilityState = 'visible';
  h.doc.emit('visibilitychange');
}

describe('startResumeGuard', () => {
  it('meldet den Stillstand beim ersten Tap, wenn die Sonde nicht zurückkommt', () => {
    const h = setup();
    background(h, 10 * 60_000);

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).toHaveBeenCalledTimes(1);
  });

  it('schweigt, wenn die Sonde durchgekommen ist — React rendert dann noch', () => {
    const h = setup({ drainImmediately: true });
    background(h, 10 * 60_000);

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).not.toHaveBeenCalled();
  });

  /**
   * Der Fall, der einen Timeout als Wächter ausschließt: der Hauptthread war
   * nur beschäftigt. Die Sonde lag vor dem Tap in der Warteschlange, ist
   * also vor ihm durch — und der Tap darf dann nichts melden.
   */
  it('meldet nichts, wenn die Sonde vor dem Tap noch durchkommt', () => {
    const h = setup();
    background(h, 10 * 60_000);

    h.tick(3_000);
    h.drain();
    h.win.emit('pointerdown');

    expect(h.onStalled).not.toHaveBeenCalled();
  });

  it('räumt den Hinweis weg, wenn die Sonde verspätet zurückkommt', () => {
    const h = setup();
    background(h, 10 * 60_000);
    h.tick(2_000);
    h.win.emit('pointerdown');
    expect(h.onStalled).toHaveBeenCalledTimes(1);

    h.drain();

    expect(h.onRecovered).toHaveBeenCalledTimes(1);
  });

  it('ruft onRecovered nicht, wenn nie etwas gemeldet wurde', () => {
    const h = setup();
    background(h, 10 * 60_000);

    h.drain();

    expect(h.onRecovered).not.toHaveBeenCalled();
  });

  it('meldet höchstens einmal pro Rückkehr', () => {
    const h = setup();
    background(h, 10 * 60_000);
    h.tick(2_000);

    h.win.emit('pointerdown');
    h.win.emit('pointerdown');
    h.win.emit('pointerdown');

    expect(h.onStalled).toHaveBeenCalledTimes(1);
  });

  it('prüft einen kurzen Wechsel gar nicht — iOS friert dabei nichts ein', () => {
    const h = setup();
    background(h, 5_000);

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).not.toHaveBeenCalled();
  });

  it('ignoriert einen Tap, der schneller kommt als die erste Runde durch den Kanal', () => {
    const h = setup();
    background(h, 10 * 60_000);

    h.tick(10);
    h.win.emit('pointerdown');

    expect(h.onStalled).not.toHaveBeenCalled();
  });

  it('prüft auch nach `resume` aus der Page-Lifecycle-API', () => {
    const h = setup();
    h.doc.emit('freeze');
    h.tick(10 * 60_000);
    h.doc.emit('resume');

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).toHaveBeenCalledTimes(1);
  });

  /** Aus dem Page Cache zurück — dass die Seite ausgelagert war, genügt. */
  it('prüft nach einem `pageshow` mit persisted ohne Wartezeit', () => {
    const h = setup();
    h.win.emit('pageshow', { persisted: true });

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).toHaveBeenCalledTimes(1);
  });

  it('lässt ein `pageshow` ohne persisted in Ruhe', () => {
    const h = setup();
    h.win.emit('pageshow', { persisted: false });

    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).not.toHaveBeenCalled();
  });

  it('prüft jede Rückkehr neu, nicht nur die erste', () => {
    const h = setup();
    background(h, 10 * 60_000);
    h.tick(2_000);
    h.win.emit('pointerdown');
    h.drain();

    background(h, 10 * 60_000);
    h.tick(2_000);
    h.win.emit('pointerdown');

    expect(h.onStalled).toHaveBeenCalledTimes(2);
  });

  it('meldet alle Listener wieder ab', () => {
    const h = setup();
    h.stop();

    expect(h.doc.count('visibilitychange')).toBe(0);
    expect(h.doc.count('freeze')).toBe(0);
    expect(h.doc.count('resume')).toBe(0);
    expect(h.win.count('pageshow')).toBe(0);
    expect(h.win.count('pointerdown')).toBe(0);
  });

  /**
   * Der einzige Test, der die eingebaute Sonde selbst benutzt statt einer
   * eingereichten: er hält fest, dass sie durch einen ECHTEN `MessageChannel`
   * läuft und dass ihre Rückmeldung wirklich beim Wächter ankommt. Die
   * Verdrahtung ist der Teil, den die Fakes oben nicht prüfen können.
   *
   * `messageChannelProbe` ist deshalb die echte Sonde aus der Produktion, nur
   * mit einem Haken daran, der dem Test sagt, WANN ihre Runde durch ist. Das
   * ist keine Bequemlichkeit: vorher wartete der Test eine Makrotask
   * (`setTimeout(0)`) ab und nahm an, die Nachricht sei bis dahin da. Timer
   * und `MessagePort` sind aber zwei verschiedene Aufgabenquellen ohne
   * garantierte Reihenfolge — unter Last (voll parallel laufende Suite) kam
   * der Timer zuerst, die Sonde stand beim Tap noch offen, und der Wächter
   * schlug völlig korrekt Alarm. Der Test war rot, der Code nicht.
   */
  it('bleibt mit der eingebauten MessageChannel-Sonde still', async () => {
    const doc = createTarget();
    const win = createTarget();
    const onStalled = vi.fn();
    let clock = 1_000_000;
    let probeDone!: () => void;
    const probed = new Promise<void>((resolve) => {
      probeDone = resolve;
    });

    startResumeGuard({
      doc: doc as unknown as ResumeGuardDocument,
      win: win as unknown as ResumeGuardWindow,
      now: () => clock,
      onStalled,
      probe: (onDrained) =>
        messageChannelProbe(() => {
          // Erst den Wächter bedienen, dann den Test wecken — sonst könnte er
          // weiterlaufen, bevor die Rückmeldung angekommen ist.
          onDrained();
          probeDone();
        }),
    });

    doc.visibilityState = 'hidden';
    doc.emit('visibilitychange');
    clock += 10 * 60_000;
    doc.visibilityState = 'visible';
    doc.emit('visibilitychange');

    // Auf die Sonde selbst warten, nicht auf einen Timer daneben.
    await probed;
    clock += 2_000;
    win.emit('pointerdown');

    expect(onStalled).not.toHaveBeenCalled();
  });

  it('ist ohne DOM ein No-Op', () => {
    expect(() => startResumeGuard({ doc: undefined, win: undefined })()).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { createLimiter } from './limiter';

/** Task, dessen Auflösung der Test selbst steuert. */
function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createLimiter', () => {
  it('lässt nie mehr als max Tasks gleichzeitig laufen', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 6 }, () => deferred());

    const runs = gates.map((gate) =>
      limit(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await gate.promise;
        active -= 1;
      }),
    );

    // Erst zwei laufen, die anderen vier warten in der Queue.
    await Promise.resolve();
    expect(active).toBe(2);

    for (const gate of gates) gate.resolve();
    await Promise.all(runs);

    expect(peak).toBe(2);
    expect(active).toBe(0);
  });

  it('gibt den Slot auch bei einem abgelehnten Task frei', async () => {
    const limit = createLimiter(1);
    await expect(limit(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    // Ohne finally-Freigabe würde dieser Aufruf ewig in der Queue hängen.
    await expect(limit(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('arbeitet die Queue in FIFO-Reihenfolge ab', async () => {
    const limit = createLimiter(1);
    const order: number[] = [];
    const runs = [1, 2, 3].map((n) =>
      limit(async () => {
        order.push(n);
      }),
    );
    await Promise.all(runs);
    expect(order).toEqual([1, 2, 3]);
  });

  it('gibt den Rückgabewert des Tasks durch', async () => {
    const limit = createLimiter(3);
    await expect(limit(() => Promise.resolve({ it: [] }))).resolves.toEqual({ it: [] });
  });
});

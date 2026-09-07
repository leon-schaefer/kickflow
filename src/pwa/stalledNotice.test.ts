// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STALLED_NOTICE_TEXT, hideStalledNotice, showStalledNotice } from './stalledNotice';

/**
 * Der Notausgang aus einem eingefrorenen React (siehe resumeGuard.ts) —
 * deshalb ohne React gebaut und deshalb hier ohne Testing-Library geprüft.
 *
 * Ein `.test.ts` mit dem `@vitest-environment`-Docblock statt eines `.test.tsx`:
 * die Datei rendert keine Komponente, braucht aber ein DOM. Der Notausgang
 * dafür steht in vite.config.ts.
 */
afterEach(() => {
  hideStalledNotice();
  document.body.innerHTML = '';
});

describe('showStalledNotice', () => {
  it('hängt einen antippbaren Hinweis an den Body', () => {
    const onReload = vi.fn();
    showStalledNotice(onReload);

    const button = document.querySelector('button');
    expect(button?.textContent).toBe(STALLED_NOTICE_TEXT);
    button?.click();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  /** Die Meldung erscheint unangekündigt — ohne Live-Region sieht sie nur, wer sieht. */
  it('kündigt sich als Meldung an, und zwar am Rahmen', () => {
    showStalledNotice(() => {});

    const alert = document.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    // Am Button würde die Rolle „alert" die Button-Rolle verdrängen.
    expect(document.querySelector('button')?.getAttribute('role')).toBeNull();
  });

  it('bleibt bei einem zweiten Aufruf einmalig', () => {
    showStalledNotice(() => {});
    showStalledNotice(() => {});

    expect(document.querySelectorAll('button')).toHaveLength(1);
  });

  it('lässt sich wieder wegräumen — auch ohne dass er stand', () => {
    showStalledNotice(() => {});
    hideStalledNotice();
    expect(document.querySelector('button')).toBeNull();

    expect(() => hideStalledNotice()).not.toThrow();
  });

  /**
   * Steht ein Modal offen, ist alles außerhalb des Top-Layers inert: ein
   * Hinweis am Body wäre sichtbar, aber nicht antippbar — und damit kein
   * Notausgang. Begründung in stalledNotice.ts.
   */
  it('hängt sich in einen offenen Dialog, damit er nicht inert ist', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);

    showStalledNotice(() => {});

    expect(dialog.querySelector('button')?.textContent).toBe(STALLED_NOTICE_TEXT);
  });

  it('hängt sich an den Body, solange kein Dialog offen steht', () => {
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);

    showStalledNotice(() => {});

    expect(dialog.querySelector('button')).toBeNull();
    expect(document.body.querySelector('button')).not.toBeNull();
  });
});

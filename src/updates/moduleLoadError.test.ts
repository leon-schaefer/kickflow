import { describe, expect, it } from 'vitest';
import { isModuleLoadError } from './moduleLoadError';

/**
 * Die Meldungen sind echt und der Grund, warum die Erkennung über Text läuft:
 * jede Engine formuliert denselben Fehler anders, und einen Typ oder Code hat
 * er nicht. Kommt eine Engine mit einem neuen Wortlaut dazu, gehört sie hier
 * dazu — und dann fällt auch auf, dass die Fehlerseite sonst den falschen
 * Text zeigt.
 */
const REAL_MESSAGES = [
  'Failed to fetch dynamically imported module: https://kickflow.app/assets/MarketScreen-C1x9.js',
  'Importing a module script failed.',
  'error loading dynamically imported module: /assets/LineupScreen-a91f.js',
  'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
];

describe('isModuleLoadError', () => {
  it.each(REAL_MESSAGES)('erkennt „%s"', (message) => {
    expect(isModuleLoadError(new Error(message))).toBe(true);
  });

  it('erkennt die Meldung auch in der cause-Kette', () => {
    const wrapped = new Error('Beim Rendern ist ein Fehler aufgetreten', {
      cause: new Error('Failed to fetch dynamically imported module: /assets/x.js'),
    });
    expect(isModuleLoadError(wrapped)).toBe(true);
  });

  it('nimmt auch einen geworfenen String', () => {
    expect(isModuleLoadError('Importing a module script failed.')).toBe(true);
  });

  it.each([
    new Error('useLeagueId() muss innerhalb von [leagueId] aufgerufen werden.'),
    new Error('Kickbase ist gerade nicht erreichbar.'),
    new TypeError('undefined is not a function'),
  ])('hält $message für einen anderen Fehler', (error) => {
    expect(isModuleLoadError(error)).toBe(false);
  });

  it.each([null, undefined, 42, {}])('kommt mit %s klar', (value) => {
    expect(isModuleLoadError(value)).toBe(false);
  });

  /** Eine zyklische cause-Kette darf die Erkennung nicht in eine Schleife schicken. */
  it('bricht eine zyklische cause-Kette ab', () => {
    const error = new Error('a');
    error.cause = error;
    expect(() => isModuleLoadError(error)).not.toThrow();
    expect(isModuleLoadError(error)).toBe(false);
  });
});

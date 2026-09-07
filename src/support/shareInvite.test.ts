import { describe, expect, it, vi } from 'vitest';
import { INVITE_TEXT, inviteClipboardText, shareInvite } from './shareInvite';

const URL_ = 'https://kickflow.example';

function abortError(): Error {
  const error = new Error('abgebrochen');
  error.name = 'AbortError';
  return error;
}

describe('shareInvite', () => {
  it('nimmt das Teilen-Blatt, wenn es eines gibt', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    await expect(shareInvite(URL_, { share, copy: vi.fn() })).resolves.toBe('shared');
    // Die URL geht als eigenes Feld mit und steckt NICHT im Text: sonst hängt
    // sie in WhatsApp zweimal in der Nachricht.
    expect(share).toHaveBeenCalledWith({ title: 'kickflow', text: INVITE_TEXT, url: URL_ });
    expect(INVITE_TEXT).not.toContain(URL_);
  });

  it('behandelt das Wegwischen als Abbruch und nicht als Fehler', async () => {
    const copy = vi.fn();

    await expect(
      shareInvite(URL_, { share: vi.fn().mockRejectedValue(abortError()), copy }),
    ).resolves.toBe('cancelled');
    // Und fällt dabei NICHT auf die Zwischenablage: der Nutzer hat gerade
    // gesagt, dass er nicht teilen will.
    expect(copy).not.toHaveBeenCalled();
  });

  it('fällt bei jedem anderen Fehler auf die Zwischenablage', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareInvite(URL_, { share: vi.fn().mockRejectedValue(new Error('NotAllowed')), copy }),
    ).resolves.toBe('copied');
    expect(copy).toHaveBeenCalledWith(inviteClipboardText(URL_));
  });

  it('nimmt ohne Teilen-Blatt direkt die Zwischenablage — der Desktop-Fall', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);

    await expect(shareInvite(URL_, { copy })).resolves.toBe('copied');
    // Hier MUSS die URL im Text stehen, es gibt kein zweites Feld.
    expect(copy).toHaveBeenCalledWith(expect.stringContaining(URL_));
  });

  it('meldet, wenn es keinen Weg gibt oder beide scheitern', async () => {
    await expect(shareInvite(URL_, {})).resolves.toBe('failed');
    await expect(
      shareInvite(URL_, { copy: vi.fn().mockRejectedValue(new Error('kein Zugriff')) }),
    ).resolves.toBe('failed');
    await expect(
      shareInvite(URL_, {
        share: vi.fn().mockRejectedValue(new Error('NotAllowed')),
        copy: vi.fn().mockRejectedValue(new Error('kein Zugriff')),
      }),
    ).resolves.toBe('failed');
  });
});

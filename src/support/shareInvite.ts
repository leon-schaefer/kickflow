/**
 * Die Einladung in den Liga-Gruppenchat.
 *
 * Warum es das gibt: kickflow nützt nur, wer in einer Liga spielt — und jede
 * Liga hat einen Gruppenchat. Wer die App überzeugt, bringt deshalb nicht
 * einen Nutzer mit, sondern seine ganze Liga. Bis hierher gab es dafür keinen
 * Weg außer „URL aus der Adressleiste abschreiben", und in der installierten
 * PWA gibt es gar keine Adressleiste.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 *  1. `navigator.share` — das Teilen-Blatt des Systems. Auf dem Telefon der
 *     kurze Weg: der Nutzer wählt den Chat und ist fertig. Verlangt eine
 *     frische Nutzer-Geste, der Aufruf muss also am Klick hängen.
 *  2. Zwischenablage — der Desktop-Fall, wo `navigator.share` außerhalb von
 *     Safari meist fehlt.
 *
 * Der Abbruch ist KEIN Fehler und darf keine Fehlermeldung auslösen: das
 * Teilen-Blatt wegzuwischen ist eine gültige Antwort, und `navigator.share`
 * meldet sie als `AbortError`. Jeder ANDERE Fehler fällt dagegen auf die
 * Zwischenablage zurück, statt den Nutzer mit leeren Händen stehen zu lassen.
 */

/** Ohne die URL — `navigator.share` bekommt sie als eigenes Feld und hängt sie selbst an. */
export const INVITE_TEXT =
  'Ich nutze kickflow für unsere Kickbase-Liga: beste Elf je Formation, ' +
  'Verkaufsplan fürs Konto und unsere eigenen Liga-Regeln. Kostenlos im Browser.';

/** Für die Zwischenablage — dort muss die URL im Text stehen. */
export function inviteClipboardText(url: string): string {
  return `${INVITE_TEXT} ${url}`;
}

export type InviteOutcome =
  /** Über das Teilen-Blatt des Systems weitergereicht. */
  | 'shared'
  /** In der Zwischenablage — der Nutzer muss selbst einfügen. */
  | 'copied'
  /** Teilen-Blatt weggewischt. Kein Fehler, keine Meldung. */
  | 'cancelled'
  /** Kein Weg vorhanden oder beide gescheitert. */
  | 'failed';

export interface ShareTarget {
  /** `navigator.share`, wenn der Browser es kann. */
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  /** `navigator.clipboard.writeText`, wenn der Browser es kann. */
  copy?: (text: string) => Promise<void>;
}

/**
 * `AbortError` kommt als `DOMException` mit diesem Namen. Der Vergleich läuft
 * über `name` und nicht über `instanceof DOMException`: den Konstruktor gibt
 * es nicht in jeder Umgebung, in der dieser Code läuft (jsdom stellt ihn,
 * ältere WebViews nicht verlässlich).
 */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function shareInvite(url: string, target: ShareTarget): Promise<InviteOutcome> {
  if (target.share) {
    try {
      await target.share({ title: 'kickflow', text: INVITE_TEXT, url });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Alles andere (kein erlaubter Kontext, kein Ziel, Systemfehler) fällt
      // durch auf die Zwischenablage.
    }
  }

  if (target.copy) {
    try {
      await target.copy(inviteClipboardText(url));
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}

/**
 * Der echte Browser als `ShareTarget`.
 *
 * Beide Methoden werden an ihr Objekt GEBUNDEN: `navigator.share` und
 * `clipboard.writeText` werfen einen `Illegal invocation`, wenn man sie ohne
 * ihren Empfänger aufruft.
 */
export function browserShareTarget(): ShareTarget {
  const nav = window.navigator;
  return {
    share: typeof nav.share === 'function' ? nav.share.bind(nav) : undefined,
    copy:
      typeof nav.clipboard?.writeText === 'function'
        ? nav.clipboard.writeText.bind(nav.clipboard)
        : undefined,
  };
}

/** Was geteilt wird: die eigene Herkunft, ohne Pfad — die Startseite. */
export function inviteUrl(): string {
  return window.location.origin;
}

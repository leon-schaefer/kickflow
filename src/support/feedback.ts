import { isStandalone } from '@/pwa/standalone';

/**
 * Feedback aus der App heraus: Kategorie plus Freitext werden zu einer
 * fertigen Mail zusammengesetzt, die der Screen dem Mail-Programm des
 * Nutzers übergibt (src/screens/FeedbackScreen.tsx).
 *
 * WARUM MAILTO UND KEIN POST AN EINEN FORMULAR-DIENST
 *
 * kickflow hat keinen eigenen Server — die App spricht direkt mit der
 * Kickbase-API, und `connect-src` in vercel.json listet genau diesen Host und
 * das Bilder-CDN. Ein Formular-Endpunkt (Formspree, Tally, …) bräuchte einen
 * dritten Host in dieser Liste, einen Account beim Anbieter und müsste die
 * Absenderadresse selbst einsammeln, um antworten zu können. Mailto kostet
 * nichts davon: die Absenderadresse kommt aus dem Mail-Programm, der Nutzer
 * sieht vor dem Abschicken wörtlich, was rausgeht, und die CSP bleibt, wie
 * sie ist.
 *
 * Der Preis dafür ist ein Nutzer ohne eingerichtetes Mail-Programm. Ob das
 * Öffnen geklappt hat, lässt sich technisch NICHT feststellen (siehe
 * src/support/openMailto.ts) — deshalb ist `feedbackPlainText()` kein Extra,
 * sondern der zweite Ausgang: derselbe Text zum Kopieren, damit das
 * geschriebene Feedback nicht verloren ist.
 *
 * Alles hier ist pur außer `collectFeedbackContext()`, das als einziges das
 * `window` anfasst.
 */

/**
 * Wie in `leagueTabTitles`: ein Objekt als einzige Quelle für Schlüssel UND
 * Beschriftung. Der Schlüssel steht im Code, die Beschriftung im Chip und im
 * Betreff der Mail.
 */
export const FEEDBACK_CATEGORY_LABELS = {
  bug: 'Fehler',
  feature: 'Funktionswunsch',
  other: 'Sonstiges',
} as const;

export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORY_LABELS;

/** Reihenfolge der Chips = Reihenfolge im Objekt oben, nicht zweimal gepflegt. */
export const FEEDBACK_CATEGORIES = Object.entries(FEEDBACK_CATEGORY_LABELS) as [
  FeedbackCategory,
  string,
][];

/**
 * Obergrenze für den Freitext, durchgesetzt am `maxLength` des Textfelds.
 *
 * Nicht Geschmack, sondern die Grenze des Transports: eine mailto-URL landet
 * beim Betriebssystem als Kommandozeilen-Argument des Mail-Programms, und
 * dort ist bei einigen Zielen um 2000 Zeichen Schluss — darüber wird die URL
 * still abgeschnitten, und zwar am Ende, wo die technischen Angaben stehen.
 * 2000 Zeichen Freitext plus Angaben bleiben mit Abstand darunter, und wer
 * mehr zu sagen hat, schreibt die Mail direkt (Kopieren-Fallback im Screen).
 */
export const FEEDBACK_MESSAGE_MAX = 2000;

/**
 * Was neben dem Freitext mitgeht. Ausschließlich Angaben zum Build und zur
 * Umgebung — kein Kickbase-Inhalt, keine Liga, kein Kontoname. Der Screen
 * zeigt den fertigen Block vor dem Abschicken an, deshalb muss er auch für
 * einen Nutzer lesbar sein und nicht nur für den Empfänger.
 */
export interface FeedbackContext {
  version: string;
  /** `null`, wenn der Build keinen verwertbaren Git-Kontext hatte. */
  gitSha: string | null;
  standalone: boolean;
  viewport: string;
  language: string;
  userAgent: string;
}

export function collectFeedbackContext(): FeedbackContext {
  return {
    version: __APP_VERSION__,
    gitSha: __GIT_SHA__,
    standalone: isStandalone(),
    // Nicht die Bildschirmgröße, sondern das, worin die App wirklich
    // rendert: ein Layout-Fehler hängt am Viewport, und in der
    // installierten iOS-PWA ist der ein anderer als der Bildschirm.
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    language: window.navigator.language,
    userAgent: window.navigator.userAgent,
  };
}

export function formatFeedbackContext(context: FeedbackContext): string {
  return [
    `Version: ${context.version}${context.gitSha ? ` (${context.gitSha})` : ''}`,
    `Anzeige: ${context.standalone ? 'installierte PWA' : 'Browser-Tab'}`,
    `Fenster: ${context.viewport}`,
    `Sprache: ${context.language}`,
    `Browser: ${context.userAgent}`,
  ].join('\n');
}

export interface FeedbackMail {
  subject: string;
  body: string;
}

/**
 * Der Betreff trägt das Präfix `[kickflow]` und die Kategorie: damit lässt
 * sich im Postfach filtern, ohne den Text zu lesen.
 */
export function buildFeedbackMail(input: {
  category: FeedbackCategory;
  message: string;
  context: FeedbackContext;
}): FeedbackMail {
  return {
    subject: `[kickflow] ${FEEDBACK_CATEGORY_LABELS[input.category]}`,
    body: [
      input.message.trim(),
      '',
      '--',
      'Technische Angaben, damit sich das nachstellen lässt:',
      formatFeedbackContext(input.context),
    ].join('\n'),
  };
}

/**
 * Betreff und Text als ein Block — für den Kopieren-Knopf im Screen, wenn
 * kein Mail-Programm eingerichtet ist. Der Betreff MUSS mit hinein: ohne ihn
 * fehlt die Kategorie, und die steht nirgends sonst im Text.
 */
export function feedbackPlainText(mail: FeedbackMail): string {
  return `${mail.subject}\n\n${mail.body}`;
}

/**
 * Von Hand kodiert und NICHT über `URLSearchParams`: das kodiert nach
 * `application/x-www-form-urlencoded` und macht aus jedem Leerzeichen ein
 * `+`. Mail-Programme dekodieren im mailto-Query aber nach RFC 3986, wo `+`
 * ein Plus IST — der Betreff käme als `[kickflow]+Fehler` an und der ganze
 * Text mit Plus statt Leerzeichen.
 *
 * Die Adresse bleibt unkodiert: das `@` ist hier Trennzeichen und kein Wert,
 * `%40` wäre schon ein anderer Empfänger. Dass in ihr nichts steht, was den
 * Query-Teil kapern könnte (`?`, `&`), stellt `resolveFeedbackEmail()`
 * sicher.
 */
export function feedbackMailtoUrl(email: string, mail: FeedbackMail): string {
  const subject = encodeURIComponent(mail.subject);
  const body = encodeURIComponent(mail.body);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/**
 * Guard für die fest verdrahtete Empfängeradresse, im Geiste von
 * `resolveSupportUrl` (src/support/supportUrl.ts): der Wert kommt aus dem
 * eigenen Repo und nicht von außen, aber ein Tippfehler darin soll im Test
 * auffallen und nicht erst, wenn ein Nutzer sein Feedback ins Leere schickt.
 *
 * Geprüft wird mehr als „sieht aus wie eine Adresse": kein Whitespace, genau
 * ein `@`, eine Domain mit Punkt — und ausdrücklich kein `?` oder `&`, mit
 * denen sich in einer mailto-URL weitere Header (`?bcc=…`) anhängen ließen.
 */
const EMAIL_PATTERN =
  /^[^\s@,;:<>()[\]\\"'?&%]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export function resolveFeedbackEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

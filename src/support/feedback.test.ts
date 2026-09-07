import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackContext,
  buildFeedbackMail,
  feedbackMailtoUrl,
  feedbackPlainText,
  formatFeedbackContext,
  resolveFeedbackEmail,
} from './feedback';

/*
 * Nur die puren Funktionen — dieses Projekt läuft in `node` (siehe die
 * Test-Konfiguration in vite.config.ts). `collectFeedbackContext()` fasst als
 * einzige das `window` an und wird deshalb dort geprüft, wo eines steht:
 * src/screens/FeedbackScreen.test.tsx im dom-Projekt.
 */

function context(overrides: Partial<FeedbackContext> = {}): FeedbackContext {
  return {
    version: '1.2.3',
    gitSha: 'abc1234',
    standalone: false,
    viewport: '390 × 844',
    language: 'de-DE',
    userAgent: 'Test/1.0',
    ...overrides,
  };
}

describe('formatFeedbackContext', () => {
  it('nennt Version, Anzeigeart, Fenster, Sprache und Browser', () => {
    expect(formatFeedbackContext(context())).toBe(
      [
        'Version: 1.2.3 (abc1234)',
        'Anzeige: Browser-Tab',
        'Fenster: 390 × 844',
        'Sprache: de-DE',
        'Browser: Test/1.0',
      ].join('\n'),
    );
  });

  it('lässt den Commit weg, wenn der Build keinen hatte', () => {
    // __GIT_SHA__ ist null beim Export aus einem Tarball und bei manchen
    // Vercel-Previews — dann darf da kein leeres Klammerpaar stehen.
    expect(formatFeedbackContext(context({ gitSha: null }))).toContain('Version: 1.2.3\n');
  });

  it('unterscheidet installierte PWA und Tab', () => {
    // Die halbe Diagnose: Statusband-Abstände und Safe-Area-Verhalten
    // greifen nur in der installierten iOS-PWA (siehe AGENTS.md).
    expect(formatFeedbackContext(context({ standalone: true }))).toContain(
      'Anzeige: installierte PWA',
    );
  });
});

describe('buildFeedbackMail', () => {
  it('trägt die Kategorie im Betreff — damit lässt sich im Postfach filtern', () => {
    expect(buildFeedbackMail({ category: 'bug', message: 'x', context: context() }).subject).toBe(
      '[kickflow] Fehler',
    );
    expect(
      buildFeedbackMail({ category: 'feature', message: 'x', context: context() }).subject,
    ).toBe('[kickflow] Funktionswunsch');
  });

  it('stellt den Freitext vor die technischen Angaben', () => {
    const { body } = buildFeedbackMail({
      category: 'other',
      message: 'Der Optimizer ignoriert Verletzte.',
      context: context(),
    });

    expect(body).toBe(
      [
        'Der Optimizer ignoriert Verletzte.',
        '',
        '--',
        'Technische Angaben, damit sich das nachstellen lässt:',
        formatFeedbackContext(context()),
      ].join('\n'),
    );
  });

  it('trimmt den Freitext — ein Textfeld sammelt am Ende gern Leerzeilen', () => {
    const { body } = buildFeedbackMail({
      category: 'other',
      message: '\n  Kurz und gut.  \n\n',
      context: context(),
    });
    expect(body.startsWith('Kurz und gut.\n')).toBe(true);
  });
});

describe('feedbackMailtoUrl', () => {
  const mail = buildFeedbackMail({ category: 'bug', message: 'Kaputt & schief', context: context() });

  it('kodiert Betreff und Text nach RFC 3986 statt als Formulardaten', () => {
    const url = feedbackMailtoUrl('feedback@example.dev', mail);

    // Der Kern: Leerzeichen als %20 und NICHT als '+'. Mail-Programme
    // dekodieren den mailto-Query nach RFC 3986, wo '+' ein Plus ist —
    // URLSearchParams hätte hier '[kickflow]+Fehler' erzeugt.
    expect(url).toContain('?subject=%5Bkickflow%5D%20Fehler');
    expect(url).not.toContain('+');
    // Und das '&' aus dem Freitext darf den Query nicht aufsprengen.
    expect(url).toContain('Kaputt%20%26%20schief');
  });

  it('lässt die Adresse unkodiert — %40 wäre ein anderer Empfänger', () => {
    expect(feedbackMailtoUrl('feedback@example.dev', mail).startsWith(
      'mailto:feedback@example.dev?',
    )).toBe(true);
  });

  it('bringt die Zeilenumbrüche des Texts mit', () => {
    expect(feedbackMailtoUrl('feedback@example.dev', mail)).toContain('%0A');
  });
});

describe('feedbackPlainText', () => {
  it('nimmt den Betreff mit — sonst fehlt beim Kopieren die Kategorie', () => {
    const mail = buildFeedbackMail({ category: 'feature', message: 'Bitte X', context: context() });
    const text = feedbackPlainText(mail);

    expect(text.startsWith('[kickflow] Funktionswunsch\n\n')).toBe(true);
    expect(text).toContain('Bitte X');
  });
});

describe('FEEDBACK_CATEGORIES', () => {
  it('spiegelt die Beschriftungen in ihrer Reihenfolge', () => {
    // Eine Quelle für Schlüssel und Beschriftung: die Chips im Screen
    // pflegen keine zweite Liste.
    expect(FEEDBACK_CATEGORIES).toEqual(Object.entries(FEEDBACK_CATEGORY_LABELS));
    expect(FEEDBACK_CATEGORIES.map(([key]) => key)).toEqual(['bug', 'feature', 'other']);
  });
});

describe('resolveFeedbackEmail', () => {
  it('nimmt eine gewöhnliche Adresse an', () => {
    expect(resolveFeedbackEmail('feedback@codewithleon.dev')).toBe('feedback@codewithleon.dev');
    expect(resolveFeedbackEmail('vor.nach-name+kickflow@sub.example.co.uk')).toBe(
      'vor.nach-name+kickflow@sub.example.co.uk',
    );
  });

  it('trimmt Whitespace', () => {
    expect(resolveFeedbackEmail('  a@b.de\n')).toBe('a@b.de');
  });

  it('behandelt einen fehlenden Wert als „keine Adresse"', () => {
    expect(resolveFeedbackEmail(undefined)).toBeNull();
    expect(resolveFeedbackEmail(null)).toBeNull();
    expect(resolveFeedbackEmail('')).toBeNull();
    expect(resolveFeedbackEmail('   ')).toBeNull();
  });

  it('weist zurück, was keine Adresse ist', () => {
    expect(resolveFeedbackEmail('codewithleon.dev')).toBeNull();
    expect(resolveFeedbackEmail('a@localhost')).toBeNull();
    expect(resolveFeedbackEmail('a@@b.de')).toBeNull();
    expect(resolveFeedbackEmail('a b@c.de')).toBeNull();
    expect(resolveFeedbackEmail('a@b.de, c@d.de')).toBeNull();
    // Ein Schema gehört nicht in den Konstantenwert — das setzt die URL selbst.
    expect(resolveFeedbackEmail('mailto:a@b.de')).toBeNull();
  });

  it('lässt keine weiteren Mail-Header durch', () => {
    // Der eigentliche Grund für den Guard: alles hinter `?` liest ein
    // Mail-Programm als Header, ein `?bcc=…` in der Adresse würde still
    // mitverschickt.
    expect(resolveFeedbackEmail('a@b.de?bcc=x@y.de')).toBeNull();
    expect(resolveFeedbackEmail('a@b.de&cc=x@y.de')).toBeNull();
    expect(resolveFeedbackEmail('a%0Abcc:x@y.de')).toBeNull();
  });
});

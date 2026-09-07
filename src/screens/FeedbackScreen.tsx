import { useMemo, useState } from 'react';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackCategory,
  buildFeedbackMail,
  collectFeedbackContext,
  feedbackMailtoUrl,
  feedbackPlainText,
  formatFeedbackContext,
} from '@/support/feedback';
import { FEEDBACK_EMAIL } from '@/support/links';
import { openMailto } from '@/support/openMailto';
import { AppHeader } from '@/shell/AppHeader';
import { useBackTarget } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './FeedbackScreen.module.css';

/**
 * Feedback und Funktionswünsche: Kategorie, Freitext, ab in die Mail.
 *
 * Eigene Route und kein Modal, obwohl der Einstieg im Mehr-Tab sitzt: sobald
 * die Tastatur für das Textfeld aufgeht, bleibt von einem Panel auf dem
 * Telefon nichts Bedienbares übrig. Und wie die Einstellungen liegt der
 * Screen AUSSERHALB von `/:leagueId` — Feedback gehört zur App, nicht zu
 * einer Liga. Zurück führt deshalb ohne Herkunft in die Ligenliste
 * (`useBackTarget('')`), mit Herkunft in den Mehr-Tab, aus dem er verlinkt
 * ist.
 *
 * Der Ablauf ist bewusst zweigleisig, weil `openMailto` nicht sagen kann, ob
 * es geklappt hat (siehe dort): der Knopf öffnet das Mail-Programm, und
 * danach steht der Kopieren-Weg daneben. Ein „Danke, ist raus!" wäre hier
 * eine Behauptung — abgeschickt wird erst im Mail-Programm.
 */
export function FeedbackScreen() {
  const back = useBackTarget('');
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  /** null = noch nicht versucht. */
  const [copied, setCopied] = useState<boolean | null>(null);

  // Einmal pro Besuch: die Angaben beschreiben den Start des Screens, und ein
  // mitwanderndes Fenstermaß (Tastatur auf, Gerät gedreht) wäre für die
  // Diagnose eher irreführend als genauer.
  const context = useMemo(collectFeedbackContext, []);
  const contextBlock = formatFeedbackContext(context);

  const trimmed = message.trim();
  const canSubmit = trimmed.length > 0;

  function mail() {
    return buildFeedbackMail({ category, message, context });
  }

  /*
   * Jede Änderung am Text oder an der Kategorie räumt das Ergebnis der letzten
   * Übergabe weg. Sonst stünde „Text liegt bereit" über einem Text, der
   * inzwischen ein anderer ist — und der Knopf hieße weiter „Nochmal öffnen",
   * obwohl es diesmal etwas Neues zu öffnen gibt.
   */
  function reset() {
    setOpened(false);
    setFailed(false);
    setCopied(null);
  }

  /*
   * Das `preventDefault` ist Pflicht und nicht Stil — wie im LoginScreen:
   * ohne es navigiert der Browser das Formular ab, und die CSP in vercel.json
   * hat `form-action 'none'`.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setFailed(false);
    setCopied(null);
    try {
      await openMailto(feedbackMailtoUrl(FEEDBACK_EMAIL, mail()));
      setOpened(true);
    } catch {
      setFailed(true);
      setOpened(false);
    }
  }

  async function handleCopy() {
    // Kein `?.`: ohne Clipboard-API würde der Aufruf einfach nichts tun und
    // der Nutzer bekäme ein „Kopiert" zu sehen, das nicht stimmt. Sie fehlt
    // real — in einem unsicheren Kontext und in älteren WebViews.
    if (!navigator.clipboard) {
      setCopied(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(feedbackPlainText(mail()));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <AppHeader title="Feedback" back={back} />
      <div className={styles.scroll}>
        <form className={styles.content} onSubmit={handleSubmit}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Was möchtest du loswerden?</h2>
            <p className={styles.cardBody}>
              Ein Fehler, eine Funktion, die dir fehlt, oder ein Gedanke zur App — alles
              willkommen. Je konkreter, desto eher landet es in der nächsten Version.
            </p>

            {/*
             * `aria-pressed` am Chip statt `role="radio"` — wie in SortChips:
             * eine echte radiogroup verlangt Pfeiltasten-Navigation mit
             * wanderndem tabindex.
             */}
            <div className={styles.chips} role="group" aria-label="Art des Feedbacks">
              {FEEDBACK_CATEGORIES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={category === key}
                  className={cx(layout.pressable, styles.chip)}
                  onClick={() => {
                    setCategory(key);
                    reset();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/*
             * Ein nacktes `<textarea>` und kein TextField: das trägt ein
             * `<input>` und ein X zum Leeren, beides passt hier nicht. Für
             * eine einzige Fundstelle lohnt keine gemeinsame Komponente.
             */}
            <textarea
              className={styles.message}
              aria-label="Dein Feedback"
              placeholder="Was ist passiert, was hast du erwartet — oder was fehlt dir?"
              rows={8}
              maxLength={FEEDBACK_MESSAGE_MAX}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                reset();
              }}
            />
            <p className={styles.counter}>
              {message.length} von {FEEDBACK_MESSAGE_MAX} Zeichen
            </p>

            {/*
             * Die Beschriftung wechselt nach der Übergabe. Das ist die
             * unmittelbarste Rückmeldung, die es gibt: sie steht auf dem
             * Element, das gerade gedrückt wurde.
             */}
            <button
              type="submit"
              className={cx(layout.pressableH, styles.submitButton)}
              disabled={!canSubmit}
            >
              {opened ? 'Nochmal öffnen' : 'Feedback senden'}
            </button>
            {/*
             * Der Hinweis erklärt, was der Knopf TUN WIRD — nach dem Druck ist
             * das erledigt und die Ergebnis-Tafel sagt es genauer. Beides
             * gleichzeitig stehen zu lassen war der halbe Grund, warum die
             * Meldung unterging: zwei Absätze, die dasselbe erzählen, und der
             * längere zuerst.
             */}
            {!opened && !failed && (
              <p className={styles.hint}>
                Öffnet dein Mail-Programm mit dem fertigen Text — abgeschickt wird erst dort. Deine
                Absenderadresse siehst du in deinem Mail-Programm; nur über sie kann ich antworten.
              </p>
            )}

            {/*
             * Das Ergebnis ist eine abgesetzte Tafel und keine weitere Zeile
             * Kleingedrucktes: eine Bildschirmbreite grauer Hinweistext davor
             * hat jede Meldung in Fließtextgröße unsichtbar gemacht — der
             * Klick fühlte sich wirkungslos an, obwohl er wirkte. Die
             * Unterscheidung geschafft/gescheitert läuft über `role`, ein
             * echtes Attribut, das hier ohnehin verschieden ist.
             */}
            {failed && (
              <div className={styles.result} role="alert">
                <p className={styles.resultTitle}>Das Mail-Programm ging nicht auf</p>
                <p className={styles.resultBody}>
                  Wahrscheinlich ist auf diesem Gerät keins eingerichtet. Dein Text ist nicht
                  verloren: kopier ihn unten und schick ihn von Hand.
                </p>
              </div>
            )}
            {opened && !failed && (
              <div className={styles.result} role="status">
                <p className={styles.resultTitle}>Text liegt bereit</p>
                <p className={styles.resultBody}>
                  Dein Mail-Programm sollte sich mit Betreff und Text geöffnet haben — abschicken
                  musst du dort. Bleibt hier und dort alles gleich, ist auf diesem Gerät keins
                  eingerichtet: dann führt der Weg unten weiter.
                </p>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Was mitgeschickt wird</h2>
            <p className={styles.cardBody}>
              Damit sich ein Fehler nachstellen lässt, hängen unter deinem Text diese Angaben zur
              App und zum Browser. Kickbase-Daten, dein Kontoname und deine Ligen sind{' '}
              <strong>nicht</strong> dabei.
            </p>
            <details className={styles.details}>
              <summary className={styles.summary}>Angaben anzeigen</summary>
              <pre className={styles.contextBlock}>{contextBlock}</pre>
            </details>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Kein Mail-Programm?</h2>
            <p className={styles.cardBody}>
              Dann kopier dir Betreff und Text und schick sie, wie es dir passt, an{' '}
              <span className={styles.address}>{FEEDBACK_EMAIL}</span>.
            </p>
            <button
              type="button"
              className={cx(layout.pressableH, styles.copyButton)}
              onClick={handleCopy}
              disabled={!canSubmit}
            >
              Text kopieren
            </button>
            {copied === true && (
              <p className={styles.ok} role="status">
                Kopiert.
              </p>
            )}
            {copied === false && (
              <p className={styles.error} role="alert">
                Kopieren hat nicht geklappt — markier den Text im Feld oben und kopier ihn von
                Hand.
              </p>
            )}
          </section>
        </form>
      </div>
    </>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { abortable } from '@/api/kickbase/tunnel';
import { useAuth } from '@/auth/AuthProvider';
import { Modal } from '@/components/Modal';
import { assistantChatKey, openRouterKey } from '@/storage/keys';
import { withOrigin } from '@/shell/useBackTarget';
import localStore from '@/storage/local';
import { readChat, saveChat } from './chatStore';
import { askTransferAssistant } from './openRouter';
import type { transferContext } from './transferContext';
import { usePlayerLookup } from './usePlayerLookup';
import styles from './TransferAssistant.module.css';

interface Props {
  open: boolean;
  leagueId: string;
  competitionId: string | null;
  getContext: () => ReturnType<typeof transferContext>;
  onClose: () => void;
}

export function TransferAssistant({ open, leagueId, competitionId, getContext, onClose }: Props) {
  const { userId } = useAuth();
  const location = useLocation();
  const lookupPlayer = usePlayerLookup(leagueId, competitionId);
  const storageKey = openRouterKey(leagueId);
  const apiKey = open ? localStore.getItemSync(storageKey) : null;
  const chatKey = userId ? assistantChatKey(leagueId, userId) : null;
  const [chat, setChat] = useState(() => readChat(chatKey));
  const { draft: question, history } = chat;
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);
  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [open, history, pending]);

  function updateChat(next: typeof chat) {
    setChat(next);
    saveChat(chatKey, next);
  }

  function resetChat() {
    updateChat({ draft: '', history: [] });
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    const key = localStore.getItemSync(storageKey)?.trim();
    if (!text || !key || request.current) return;

    const controller = new AbortController();
    const { signal } = controller;
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    request.current = controller;
    setError('');
    setPending(true);
    try {
      const context = getContext();
      const knownPlayers = [...context.squad, ...(context.market ?? [])];
      const answer = await abortable(askTransferAssistant({
        apiKey: key,
        question: text,
        context,
        history,
        lookupPlayer: (query, lookupSignal) => lookupPlayer(query, knownPlayers, lookupSignal),
        signal,
      }), signal);
      signal.throwIfAborted();
      updateChat({ draft: '', history: [...history.slice(-7), { question: text, answer }] });
    } catch (reason) {
      if (request.current !== controller) return;
      setError(signal.aborted ? 'Die Anfrage hat zu lange gedauert. Versuche es erneut.'
        : reason instanceof Error ? reason.message : 'Die Anfrage ist fehlgeschlagen.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="KI-Transferassistent" panelClassName={styles.panel}>
      <div className={styles.body}>
        {history.length === 0 && !pending && (
          <p className={styles.notice}>
            Beim Senden gehen deine Frage, der jüngste Chatverlauf und relevante Ligadaten
            an OpenRouter und den Modellanbieter.
          </p>
        )}
        {(history.length > 0 || pending) && (
          <div className={styles.transcript} ref={transcript} role="log" aria-label="Chatverlauf" tabIndex={0}>
            {history.map((turn, index) => (
              <div className={styles.turn} key={index}>
                <p className={styles.question}><span className={styles.sender}>Du</span>{turn.question}</p>
                <div className={styles.answer}>
                  <span className={styles.sender}>GPT-6 Luna</span>
                  <div className={styles.markdown}>
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      skipHtml
                      disallowedElements={['img']}
                      components={{
                        a: ({ href, children }) => href
                          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                          : <>{children}</>,
                        table: ({ children }) => (
                          <div className={styles.tableScroll}><table>{children}</table></div>
                        ),
                      }}
                    >
                      {turn.answer}
                    </Markdown>
                  </div>
                </div>
              </div>
            ))}
            {pending && (
              <div className={styles.turn}>
                <p className={styles.question}><span className={styles.sender}>Du</span>{question.trim()}</p>
                <p className={styles.answer} role="status">GPT-6 Luna antwortet …</p>
              </div>
            )}
          </div>
        )}
        {!apiKey?.trim() && (
          <p className={styles.notice}>
            Hinterlege den OpenRouter-Schlüssel für diese Liga in den{' '}
            <Link className={styles.settingsLink} to="/settings"
              state={withOrigin(location.pathname + location.search, 'Zur Liga').state}>
              Einstellungen
            </Link>.
          </p>
        )}
        <form className={styles.form} onSubmit={submit} autoComplete="off">
          <textarea className={styles.input} aria-label="Deine Transferfrage" rows={2}
            value={pending ? '' : question} required maxLength={1200}
            placeholder="Wen sollte ich kaufen oder verkaufen?"
            onChange={(event) => updateChat({ ...chat, draft: event.target.value })} disabled={pending} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={onClose}>Schließen</button>
            {(history.length > 0 || question) && (
              <button className={styles.button} type="button" disabled={pending} onClick={resetChat}>
                Chat zurücksetzen
              </button>
            )}
            <button className={styles.submit} type="submit" disabled={pending || !apiKey?.trim() || !question.trim()}>
              Frage senden
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

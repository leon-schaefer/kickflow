import { useEffect, useRef, useState, type FormEvent } from 'react';
import { abortable } from '@/api/kickbase/tunnel';
import { useAuth } from '@/auth/AuthProvider';
import { Modal } from '@/components/Modal';
import { assistantChatKey, openRouterKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { readChat, saveChat } from './chatStore';
import { askTransferAssistant } from './openRouter';
import type { transferContext } from './transferContext';
import { usePlayerLookup } from './usePlayerLookup';
import styles from './TransferAssistant.module.css';

interface Props {
  leagueId: string;
  competitionId: string | null;
  getContext: () => ReturnType<typeof transferContext>;
  onClose: () => void;
}

export function TransferAssistant({ leagueId, competitionId, getContext, onClose }: Props) {
  const { userId } = useAuth();
  const lookupPlayer = usePlayerLookup(leagueId, competitionId);
  const storageKey = openRouterKey(leagueId);
  const [apiKey, setApiKey] = useState(() => localStore.getItemSync(storageKey) ?? '');
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
  }, [history, pending]);

  function updateApiKey(value: string) {
    setApiKey(value);
    const key = value.trim();
    if (key) void localStore.setItem(storageKey, key);
    else void localStore.removeItem(storageKey);
  }

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
    const key = apiKey.trim();
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
    <Modal open onClose={onClose} title="KI-Transferassistent" panelClassName={styles.panel}>
      <div className={styles.body}>
        <p className={styles.notice}>
          Beim Senden gehen deine Frage, der jüngste Chatverlauf, Kader, Markt und Budget
          sowie bei Bedarf Spielerdetails an OpenRouter und den Modellanbieter.
          Dein OpenRouter-Schlüssel wird für diese Liga im Browser gespeichert.
          Du kannst ihn löschen, indem du das Schlüsselfeld leerst. Dein Chat bleibt hier gespeichert.
        </p>
        {history.length > 0 && (
          <div className={styles.transcript} ref={transcript} role="log" aria-label="Chatverlauf">
            {history.map((turn, index) => (
              <div className={styles.turn} key={index}>
                <p className={styles.question}><strong>Du</strong> {turn.question}</p>
                <p className={styles.answer}>{turn.answer}</p>
              </div>
            ))}
          </div>
        )}
        <form className={styles.form} onSubmit={submit} autoComplete="off">
          <label className={styles.field}>
            OpenRouter-API-Schlüssel
            <input className={styles.input} type="password" value={apiKey} required
              onChange={(event) => updateApiKey(event.target.value)} spellCheck={false} disabled={pending} />
          </label>
          <label className={styles.field}>
            Deine Transferfrage
            <textarea className={styles.input} rows={3} value={question} required maxLength={1200}
              placeholder="Wen sollte ich verkaufen, um mir eine Verstärkung leisten zu können?"
              onChange={(event) => updateChat({ ...chat, draft: event.target.value })} disabled={pending} />
          </label>
          {pending && <p className={styles.notice} role="status">GPT-6 Luna prüft deine Frage …</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={onClose}>Schließen</button>
            {(history.length > 0 || question) && (
              <button className={styles.button} type="button" disabled={pending} onClick={resetChat}>
                Chat zurücksetzen
              </button>
            )}
            <button className={styles.submit} type="submit" disabled={pending || !apiKey.trim() || !question.trim()}>
              Frage senden
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

/**
 * Dünner fetch-Wrapper um die inoffizielle Kickbase-v4-API.
 *
 * Der konfigurierte Tunnel transportiert TLS-Bytes; erst der Client liest HTTP.
 */
import { prepareTunnel, requestText } from './tunnel';

const BASE_URL = 'https://api.kickbase.com';
const DEFAULT_TIMEOUT_MS = 10_000;

export class KickbaseError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'KickbaseError';
    this.status = status;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface KbFetchOptions {
  token?: string | null;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Ruft einen Kickbase-v4-Endpoint auf. `path` beginnt mit "/", z.B. "/v4/leagues/selection".
 */
export async function kbFetch<T = unknown>(path: string, options: KbFetchOptions = {}): Promise<T> {
  const { token, method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await prepareTunnel(controller.signal);
    controller.signal.throwIfAborted();
    timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const response = await requestText(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = response.text.length > 0 ? safeJsonParse(response.text) : null;
    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && 'errMsg' in data && typeof data.errMsg === 'string'
          ? data.errMsg : null) ?? `Kickbase antwortete mit Status ${response.status}.`;
      throw new KickbaseError(message, response.status, data);
    }
    return data as T;
  } catch (cause) {
    if (cause instanceof KickbaseError) throw cause;
    if (timedOut) {
      throw new KickbaseError('Kickbase-Anfrage hat zu lange gedauert (Timeout).', 408, null);
    }
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Abgebrochen', 'AbortError');
    throw new KickbaseError('Die sichere Verbindung zu Kickbase konnte nicht aufgebaut werden. Bitte erneut versuchen.', 0, cause);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

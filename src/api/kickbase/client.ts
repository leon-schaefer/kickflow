/**
 * Dünner fetch-Wrapper um die inoffizielle Kickbase-v4-API.
 *
 * Bewusst framework-frei: kein React-Native-, kein DOM-Import. Läuft
 * unverändert im Browser, in React Native und (falls Kickbase seine
 * CORS-Policy je schließt) in einer Node-Umgebung.
 */

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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  // Falls der Aufrufer ein eigenes Signal mitgibt, brechen wir zusätzlich ab.
  options.signal?.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new KickbaseError('Kickbase-Anfrage hat zu lange gedauert (Timeout).', 408, null);
    }
    throw new KickbaseError('Kickbase ist gerade nicht erreichbar.', 0, cause);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const data = text.length > 0 ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'errMsg' in data && typeof data.errMsg === 'string'
        ? data.errMsg
        : null) ?? `Kickbase antwortete mit Status ${response.status}.`;
    throw new KickbaseError(message, response.status, data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

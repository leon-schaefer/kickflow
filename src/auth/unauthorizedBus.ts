/**
 * Minimaler Pub/Sub, um einen 401/403 von Kickbase aus dem QueryClient
 * (existiert außerhalb des React-Baums, kennt keine Hooks) an den
 * AuthProvider zu melden. useQuery hat in TanStack Query v5 kein
 * per-Hook-`onError` mehr — das läuft nur noch global über QueryCache/
 * MutationCache, daher dieser Umweg statt eines Hook-Callbacks.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUnauthorized(): void {
  for (const listener of listeners) listener();
}

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { KickbaseError } from '@/api/kickbase';
import { notifyUnauthorized } from '@/auth/unauthorizedBus';

function handleError(error: unknown): void {
  if (error instanceof KickbaseError && error.isUnauthorized) {
    notifyUnauthorized();
  }
}

/**
 * Kein Polling (`refetchInterval`) irgendwo in der App — jeder Request an
 * Kickbase folgt einer Nutzeraktion. Kickbase ist inoffiziell und hinter
 * Cloudflare; unnötiges Hintergrundpolling erhöht nur das Sperrrisiko.
 *
 * QueryCache/MutationCache.onError ist der einzige Ort für einen globalen
 * Error-Hook in TanStack Query v5 (useQuery selbst hat kein onError mehr).
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

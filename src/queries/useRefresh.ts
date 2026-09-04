import { useCallback, useRef, useState } from 'react';

/** Alles mit `refetch()` — Query, useQueries-Bündel (usePlaytimes) oder Mutation. */
export interface Refetchable {
  refetch: () => Promise<unknown>;
}

export interface RefreshState {
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Bündelt die `refetch()`-Aufrufe eines Screens zu einem Pull-to-Refresh.
 * Eigener `refreshing`-State statt `isRefetching` einer einzelnen Query —
 * der Spinner soll erst verschwinden, wenn ALLE übergebenen Queries durch
 * sind, nicht nur die erste.
 *
 * `refetch()` ignoriert `enabled` (siehe @tanstack/query-core queryObserver),
 * funktioniert also auch für eine aktuell deaktivierte Query.
 */
export function useRefresh(...queries: Refetchable[]): RefreshState {
  const [refreshing, setRefreshing] = useState(false);
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  const busyRef = useRef(false);

  const onRefresh = useCallback(() => {
    if (busyRef.current) return; // Doppel-Pull schlucken — Kickbase ist hinter Cloudflare, kein Bedarf an Parallel-Requests
    busyRef.current = true;
    setRefreshing(true);
    Promise.all(queriesRef.current.map((q) => q.refetch())).finally(() => {
      busyRef.current = false;
      setRefreshing(false);
    });
  }, []);

  return { refreshing, onRefresh };
}

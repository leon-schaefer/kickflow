import { type RefreshState, useRefresh } from '@/queries/useRefresh';
import { Refreshable } from './Refreshable';
import { Spinner } from './Spinner';
import styles from './QueryState.module.css';

interface QueryLike {
  error: unknown;
  refetch: () => Promise<unknown>;
}

interface Props {
  /** Das Query-Objekt von useQuery — nur error/refetch werden gebraucht. */
  query: QueryLike;
  /** z.B. "Kader" -> "Kader konnte nicht geladen werden." */
  label: string;
  /**
   * Refresh-State des aufrufenden Screens (z.B. aus useRefresh(mehrere,
   * queries)), damit ein Pull auch im Lade-/Fehlerzustand alles neu lädt,
   * was der Screen zeigt — nicht nur `query`. Fehlt er, baut sich QueryState
   * selbst einen aus `query`.
   */
  refresh?: RefreshState;
}

/**
 * Rendert Lade- bzw. Fehlerzustand eines Queries. Wird nur aufgerufen, wenn
 * noch keine Daten da sind (`!data`) — ein deaktivierter Query (kein Fehler,
 * nur `enabled: false`) zeigt hier also den Spinner statt einer Fehlermeldung,
 * die es vorher fälschlich war, sobald z.B. ein Tab-Wechsel den Query kurz
 * deaktiviert hat.
 *
 * In eine `Refreshable` gewickelt, damit auch dieser Zustand ziehbar ist —
 * gerade wenn das Laden fehlschlägt, ist das der Moment, in dem man
 * instinktiv zieht.
 *
 * Die zwei Knoten (Scroller außen, Inhalt innen) ersetzen `style` plus
 * `contentContainerStyle` der ScrollView: das Scrollen gehört an den äußeren,
 * die Zentrierung und das Padding an den inneren.
 */
export function QueryState({ query, label, refresh }: Props) {
  const ownRefresh = useRefresh(query);
  const { refreshing, onRefresh } = refresh ?? ownRefresh;

  return (
    <Refreshable refreshing={refreshing} onRefresh={onRefresh}>
      {(p) => (
        <div {...p} className={styles.scroll}>
          <div className={styles.center}>
            {query.error ? (
              <>
                <p className={styles.errorText}>
                  {query.error instanceof Error
                    ? query.error.message
                    : `${label} konnte nicht geladen werden.`}
                </p>
                <button type="button" className={styles.retryButton} onClick={() => query.refetch()}>
                  Erneut versuchen
                </button>
              </>
            ) : (
              <Spinner />
            )}
          </div>
        </div>
      )}
    </Refreshable>
  );
}

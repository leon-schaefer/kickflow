import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { NO_EXCLUSIONS, parseStoredExclusions, serializeExclusions, toggleExclusion } from './excludedFromSale';

function storageKey(leagueId: string): string {
  return `kickflow.excludedFromSale.v1.${leagueId}`;
}

export interface ExcludedFromSale {
  /** IDs der vom Verkauf ausgeschlossenen Spieler. */
  excludedIds: ReadonlySet<string>;
  isExcluded: (playerId: string) => boolean;
  /** Schaltet den Ausschluss um und persistiert sofort (Vorbild: useLeagueRules.updateRule). */
  toggleExcluded: (playerId: string) => void;
  /** false, solange der gespeicherte Stand noch geladen wird — bis dahin gilt "nichts ausgeschlossen". */
  loaded: boolean;
}

/**
 * Vom Verkauf ausgeschlossene Spieler, lokal pro Liga persistiert — Kickbase
 * hat dafür keinen Endpunkt (siehe excludedFromSale.ts).
 *
 * NICHT direkt in Screens aufrufen — der State ist lokal, zwei Aufrufe ergeben
 * zwei Kopien, die nichts voneinander mitbekommen (genau der Fehler, den
 * LeagueRulesContext.tsx dokumentiert). Einziger Aufrufer ist
 * ExcludedFromSaleProvider; Screens nutzen useExcludedFromSaleContext().
 */
export function useExcludedFromSale(leagueId: string): ExcludedFromSale {
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(NO_EXCLUSIONS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setExcludedIds(NO_EXCLUSIONS);
    AsyncStorage.getItem(storageKey(leagueId)).then((raw) => {
      if (cancelled) return;
      setExcludedIds(parseStoredExclusions(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const toggleExcluded = useCallback(
    (playerId: string) => {
      setExcludedIds((current) => {
        const next = toggleExclusion(current, playerId);
        AsyncStorage.setItem(storageKey(leagueId), serializeExclusions(next));
        return next;
      });
    },
    [leagueId],
  );

  const isExcluded = useCallback((playerId: string) => excludedIds.has(playerId), [excludedIds]);

  return { excludedIds, isExcluded, toggleExcluded, loaded };
}

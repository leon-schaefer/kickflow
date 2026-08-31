import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_RULES, parseStoredRules, type LineupRule } from './rules';

function storageKey(leagueId: string): string {
  return `kickflow.rules.v1.${leagueId}`;
}

export interface LeagueRules {
  rules: LineupRule[];
  /** Ersetzt eine einzelne Regel anhand ihrer `id` und persistiert sofort (Vorbild: src/leagues/lastLeague.ts). */
  updateRule: (id: LineupRule['id'], patch: Partial<LineupRule>) => void;
  /** false, während die gespeicherten Regeln noch geladen werden — bis dahin gelten die Defaults. */
  loaded: boolean;
}

/**
 * Liga-eigene Optimizer-Regeln, lokal pro Liga persistiert — Kickbase hat
 * dafür keinen Settings-Endpunkt. Kein Auto-Resume-Problem wie bei
 * lastLeague.ts: jede Liga hat ihren eigenen Key, ein Wechsel lädt neu.
 */
export function useLeagueRules(leagueId: string): LeagueRules {
  const [rules, setRules] = useState<LineupRule[]>(DEFAULT_RULES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    AsyncStorage.getItem(storageKey(leagueId)).then((raw) => {
      if (cancelled) return;
      setRules(parseStoredRules(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const updateRule = useCallback(
    (id: LineupRule['id'], patch: Partial<LineupRule>) => {
      setRules((current) => {
        const next = current.map((rule) => (rule.id === id ? ({ ...rule, ...patch } as LineupRule) : rule));
        AsyncStorage.setItem(storageKey(leagueId), JSON.stringify(next));
        return next;
      });
    },
    [leagueId],
  );

  return { rules, updateRule, loaded };
}

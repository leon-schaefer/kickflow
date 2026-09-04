import { leagueRulesKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RULES, parseStoredRules, type LineupRule, type MaxPerTeamRule } from './rules';

export interface LeagueRules {
  rules: LineupRule[];
  /** Ersetzt eine einzelne Regel anhand ihrer `id` und persistiert sofort (Vorbild: src/leagues/lastLeague.ts). */
  updateRule: (id: LineupRule['id'], patch: Partial<LineupRule>) => void;
  /** false, während die gespeicherten Regeln noch geladen werden — bis dahin gelten die Defaults. */
  loaded: boolean;
  /** Kickbases eigener Wert für diese Liga (`mpst`), nur zur Anzeige — siehe fallbackMax-Parameter. */
  leagueMax: number | null;
}

/**
 * Liga-eigene Optimizer-Regeln, lokal pro Liga persistiert — Kickbase hat
 * dafür keinen Settings-Endpunkt. Kein Auto-Resume-Problem wie bei
 * lastLeague.ts: jede Liga hat ihren eigenen Key, ein Wechsel lädt neu.
 *
 * NICHT direkt in Screens aufrufen — der State ist lokal, zwei Aufrufe ergeben
 * zwei Kopien, die nichts voneinander mitbekommen. Einziger Aufrufer ist
 * LeagueRulesProvider; Screens nutzen useLeagueRulesContext().
 *
 * @param fallbackMax Kickbases eigener Wert für "max. Spieler pro Verein"
 *   (`overview.mpst`, siehe LeagueRulesContext.tsx). Nur solange nichts
 *   gespeichert ist UND der Nutzer nichts geändert hat, wird `max` der
 *   maxPerTeam-Regel darauf vorbelegt — rein im State, nie automatisch
 *   persistiert (das passiert weiterhin ausschließlich in updateRule).
 */
export function useLeagueRules(leagueId: string, fallbackMax: number | null = null): LeagueRules {
  const [rules, setRules] = useState<LineupRule[]>(DEFAULT_RULES);
  const [loaded, setLoaded] = useState(false);
  const hasStoredRef = useRef(false);
  const userModifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    hasStoredRef.current = false;
    userModifiedRef.current = false;
    localStore.getItem(leagueRulesKey(leagueId)).then((raw) => {
      if (cancelled) return;
      hasStoredRef.current = raw !== null;
      setRules(parseStoredRules(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  // Vorbelegung mit fallbackMax, solange nichts gespeichert/geändert wurde.
  // `overview.mpst` trifft oft erst nach dem Storage-Load ein (eigener
  // Request), deshalb ein eigener Effekt statt nur beim Laden zu prüfen.
  useEffect(() => {
    if (!loaded || hasStoredRef.current || userModifiedRef.current || fallbackMax == null) return;
    setRules((current) => {
      const maxPerTeamRule = current.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam');
      if (!maxPerTeamRule || maxPerTeamRule.max === fallbackMax) return current;
      return current.map((rule) => (rule.kind === 'maxPerTeam' ? { ...rule, max: fallbackMax } : rule));
    });
  }, [loaded, fallbackMax]);

  const updateRule = useCallback(
    (id: LineupRule['id'], patch: Partial<LineupRule>) => {
      userModifiedRef.current = true;
      setRules((current) => {
        const next = current.map((rule) => (rule.id === id ? ({ ...rule, ...patch } as LineupRule) : rule));
        localStore.setItem(leagueRulesKey(leagueId), JSON.stringify(next));
        return next;
      });
    },
    [leagueId],
  );

  return { rules, updateRule, loaded, leagueMax: fallbackMax };
}

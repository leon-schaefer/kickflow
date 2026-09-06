import { createContext, use, useCallback, useMemo, useState } from 'react';
import { EMPTY_PLAYER_FILTER, type PlayerFilterCriteria } from '@/utils/playerFilter';
import type { PlayerSortKey } from '@/utils/playerMetric';

/** Die beiden Listen mit Filterleiste und Sortier-Chips: Spieler-Tab und Markt. */
export type PlayerListId = 'players' | 'market';

/** Was der Nutzer an einer der beiden Listen eingestellt hat. */
export interface PlayerListView {
  sortKey: PlayerSortKey;
  filter: PlayerFilterCriteria;
  /** Der führende Chip vor den Sortier-Chips: „Mein Kader" bzw. „Nur meine Gebote". */
  onlyMine: boolean;
}

/**
 * Die Startwerte sind pro Liste verschieden und bleiben es: der Spieler-Tab
 * ist ein Bestandsverzeichnis und beginnt beim Marktwert, der Markt fragt
 * zuerst „lohnt der Preis?" und beginnt bei Punkte/Mio.
 */
const DEFAULT_VIEWS: Record<PlayerListId, PlayerListView> = {
  players: { sortKey: 'marketValue', filter: EMPTY_PLAYER_FILTER, onlyMine: false },
  market: { sortKey: 'avgPerMillion', filter: EMPTY_PLAYER_FILTER, onlyMine: false },
};

interface PlayerListViewStore {
  views: Record<PlayerListId, PlayerListView>;
  setView: (id: PlayerListId, next: React.SetStateAction<PlayerListView>) => void;
}

const PlayerListViewContext = createContext<PlayerListViewStore | null>(null);

/**
 * Filter und Sortierung der beiden Spielerlisten leben ÜBER den Tabs, nicht in
 * ihnen — aus demselben Grund wie der Aufstellungs-Entwurf nebenan (siehe
 * LineupDraftContext).
 *
 * Von beiden Listen führt der häufigste Weg auf ein Spielerprofil, und
 * `/:leagueId/player/:playerId` ist eine Geschwister-Route: React Router
 * ERSETZT den Tab damit, statt sich wie früher ein Stack-Screen darüber zu
 * legen. Der Screen wird ausgehängt, mit `useState` im Screen war die Rückkehr
 * also ein Neuanfang — die mühsam gesetzten Vereins- und Positions-Chips weg,
 * die Sortierung zurück auf Standard. Genau dieser Weg (Liste durchsehen,
 * Profil prüfen, zurück zur Liste) ist der Kern beider Screens.
 *
 * Der Provider hängt in src/routes/LeagueLayout.tsx INNERHALB des
 * `key={leagueId}`: die Vereins-Chips im Filter tragen IDs aus dem Wettbewerb
 * der aktuellen Liga, ein Wechsel muss sie deshalb fallen lassen statt sie
 * mitzunehmen.
 *
 * Bewusst NICHT im localStorage: die Einstellung ist eine Sitzungssache. Ein
 * Filter, der Wochen später beim Öffnen der App noch klemmt, sieht wie eine
 * halb geladene Liste aus.
 */
export function PlayerListViewProvider({ children }: { children: React.ReactNode }) {
  const [views, setViews] = useState(DEFAULT_VIEWS);

  // Stabile Identität — nur `views` darf den Context-Wert bewegen, sonst
  // renderten beide Listen bei jedem Tastendruck in der anderen mit.
  const setView = useCallback((id: PlayerListId, next: React.SetStateAction<PlayerListView>) => {
    setViews((current) => ({
      ...current,
      [id]: typeof next === 'function' ? next(current[id]) : next,
    }));
  }, []);

  const value = useMemo<PlayerListViewStore>(() => ({ views, setView }), [views, setView]);

  return <PlayerListViewContext.Provider value={value}>{children}</PlayerListViewContext.Provider>;
}

/**
 * Wie `useState` zu benutzen, nur dass der Wert die Navigation überlebt. Der
 * Provider sitzt in src/routes/LeagueLayout.tsx — Vorbild:
 * useLineupDraftContext().
 */
export function usePlayerListView(
  id: PlayerListId,
): [PlayerListView, (next: React.SetStateAction<PlayerListView>) => void] {
  const store = use(PlayerListViewContext);
  if (!store)
    throw new Error('usePlayerListView() muss innerhalb von [leagueId] aufgerufen werden.');

  const { views, setView } = store;
  const setThisView = useCallback(
    (next: React.SetStateAction<PlayerListView>) => setView(id, next),
    [setView, id],
  );

  return [views[id], setThisView];
}

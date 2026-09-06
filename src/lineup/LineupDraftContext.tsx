import { createContext, use, useMemo, useState } from 'react';
import type { OptimizerDiff } from './useLineupOptimizer';

/** Stand vor dem letzten „Optimieren" — Grundlage für „Zurücksetzen". */
export interface PreOptimizeState {
  formation: string;
  draftIds: string[];
}

/**
 * Die Bearbeitungs-Sitzung des Aufstellungs-Tabs: ob bearbeitet wird, der
 * Entwurf selbst und die Marker, die daran hängen.
 */
export interface LineupDraft {
  editing: boolean;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  formation: string;
  setFormation: React.Dispatch<React.SetStateAction<string>>;
  draftIds: string[];
  setDraftIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedBenchId: string | null;
  setSelectedBenchId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Eingefroren beim letzten „Optimieren" — treibt Marker und Diff-Zeile. */
  appliedDiff: OptimizerDiff | null;
  setAppliedDiff: React.Dispatch<React.SetStateAction<OptimizerDiff | null>>;
  preOptimize: PreOptimizeState | null;
  setPreOptimize: React.Dispatch<React.SetStateAction<PreOptimizeState | null>>;
  /** Rückmeldung der automatischen Formationserkennung, lebt bis zum nächsten Eingriff. */
  autoNote: string | null;
  setAutoNote: React.Dispatch<React.SetStateAction<string | null>>;
}

const LineupDraftContext = createContext<LineupDraft | null>(null);

/**
 * Der Entwurf lebt ÜBER dem Aufstellungs-Tab, nicht in ihm.
 *
 * Grund: Von der Aufstellung führen echte Navigationen weg — die
 * „Regeln"-Zeile der OptimizerBar auf `/:leagueId/rules`, eine Spielerkarte
 * aufs Profil. In React Router ersetzen diese Routen den Tab, statt sich wie
 * früher in React Navigation als Stack-Screen darüber zu legen: der
 * LineupScreen wird ausgehängt. Mit `useState` im Screen war die Rückkehr
 * deshalb ein Neuanfang — der Optimizer zugeklappt, der halbfertige Entwurf
 * weg. Und gerade der Weg über die Regeln ist einer, den man mitten im
 * Optimieren geht.
 *
 * Der Provider hängt in src/routes/LeagueLayout.tsx INNERHALB des
 * `key={leagueId}`, anders als die beiden Speicher-Provider daneben: ein
 * ungespeicherter Entwurf gehört genau einer Liga und muss beim Liga-Wechsel
 * sterben, sonst ginge die Elf der alten Liga an die neue (siehe dort).
 */
export function LineupDraftProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [formation, setFormation] = useState<string>('');
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [appliedDiff, setAppliedDiff] = useState<OptimizerDiff | null>(null);
  const [preOptimize, setPreOptimize] = useState<PreOptimizeState | null>(null);
  const [autoNote, setAutoNote] = useState<string | null>(null);

  // Stabile Identität, solange sich nichts ändert: der Wert eines Providers
  // wandert erfahrungsgemäß irgendwann in eine Effect-Abhängigkeit, und ein
  // pro Render neu gebautes Objekt wäre dort eine Endlosschleife.
  const value = useMemo<LineupDraft>(
    () => ({
      editing,
      setEditing,
      formation,
      setFormation,
      draftIds,
      setDraftIds,
      selectedBenchId,
      setSelectedBenchId,
      appliedDiff,
      setAppliedDiff,
      preOptimize,
      setPreOptimize,
      autoNote,
      setAutoNote,
    }),
    [editing, formation, draftIds, selectedBenchId, appliedDiff, preOptimize, autoNote],
  );

  return <LineupDraftContext.Provider value={value}>{children}</LineupDraftContext.Provider>;
}

/** Der Provider sitzt in src/routes/LeagueLayout.tsx — Vorbild: useLeagueRulesContext(). */
export function useLineupDraftContext(): LineupDraft {
  const value = use(LineupDraftContext);
  if (!value)
    throw new Error('useLineupDraftContext() muss innerhalb von [leagueId] aufgerufen werden.');
  return value;
}

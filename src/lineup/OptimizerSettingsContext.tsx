import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { OptimizerMetric } from '@/utils/lineupOptimizer';
import { useLeagueRulesContext } from './LeagueRulesContext';
import type { LineupRule } from './rules';

export function useOptimizerSettings(rules: readonly LineupRule[]) {
  const [metric, setMetric] = useState<OptimizerMetric>('points');
  const [balanceBudget, setBalanceBudget] = useState(false);
  const [ignoredRuleIds, setIgnoredRuleIds] = useState<Set<LineupRule['id']>>(new Set());

  useEffect(() => {
    // Bei geänderten Liga-Regeln gilt die neue Konfiguration vollständig.
    setIgnoredRuleIds((current) => (current.size === 0 ? current : new Set()));
  }, [rules]);

  return { metric, setMetric, balanceBudget, setBalanceBudget, ignoredRuleIds, setIgnoredRuleIds };
}

const OptimizerSettingsContext = createContext<ReturnType<typeof useOptimizerSettings> | null>(null);

export function OptimizerSettingsProvider({ children }: { children: ReactNode }) {
  const { rules } = useLeagueRulesContext();
  const settings = useOptimizerSettings(rules);
  return <OptimizerSettingsContext value={settings}>{children}</OptimizerSettingsContext>;
}

export function useSharedOptimizerSettings() {
  return use(OptimizerSettingsContext);
}

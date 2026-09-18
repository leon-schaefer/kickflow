import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FormationResult, OptimizationResult } from '@/utils/lineupOptimizer';
import { fillerLabel, OptimizerBar } from './OptimizerBar';

/**
 * Die Leiste zeigt das Optimizer-Ergebnis, sie rechnet nicht — deshalb hier
 * gestellte Ergebnisse. Die Rechnung selbst (wann ein Ausfall auffüllt) steht
 * in src/utils/lineupOptimizer.test.ts.
 */
function formation(overrides: Partial<FormationResult> = {}): FormationResult {
  return {
    formation: '4-4-2',
    feasible: true,
    score: 88,
    scoreAverage: 8,
    playerIds: ['GK0'],
    fillerIds: [],
    missing: {},
    blockedByRuleIds: [],
    ...overrides,
  };
}

function result(best: FormationResult | null, ranking: FormationResult[] = best ? [best] : []): OptimizationResult {
  return {
    metric: 'points',
    ranking,
    best,
    excludedPlayerIds: [],
    usedInAnyFormation: new Set(),
    blockedRuleIds: [],
  };
}

function renderBar(optimization: OptimizationResult) {
  const names: Record<string, string> = { GK0: 'Neuer', DEF3: 'Tah' };
  render(
    <OptimizerBar
      metric="points"
      onChangeMetric={vi.fn()}
      result={optimization}
      appliedDiff={null}
      onApply={vi.fn()}
      onReset={vi.fn()}
      balanceBudget={false}
      onChangeBalanceBudget={vi.fn()}
      deficit={0}
      rules={[]}
      onOpenRules={vi.fn()}
      onIgnoreRule={vi.fn()}
      draftViolations={[]}
      nameById={(id) => names[id]}
    />,
  );
}

describe('OptimizerBar', () => {
  it('nennt den Auffüller beim Namen und dass er 0 Punkte zählt', () => {
    renderBar(result(formation({ fillerIds: ['GK0'] })));
    expect(screen.getByText(/Beste Formation 4-4-2/)).toBeInTheDocument();
    expect(
      screen.getByText('Mit Ausfall aufgefüllt: Neuer — kein einsatzfähiger Ersatz im Kader, zählt 0 Punkte.'),
    ).toBeInTheDocument();
    // Eine aufgefüllte Elf ist übernehmbar — nur die Warnung steht daneben.
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled();
  });

  it('schweigt ohne Auffüller', () => {
    renderBar(result(formation()));
    expect(screen.queryByText(/aufgefüllt/)).not.toBeInTheDocument();
  });

  it('meldet weiter "Keine Formation besetzbar", wenn auch Auffüller nicht reichen', () => {
    const infeasible = formation({ feasible: false, score: null, scoreAverage: null, playerIds: [], missing: { DEF: 1 } });
    renderBar(result(null, [infeasible]));
    expect(screen.getByText('Keine Formation besetzbar.')).toBeInTheDocument();
    expect(screen.getByText('Es fehlen 1 ABW.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeDisabled();
  });
});

describe('fillerLabel', () => {
  const names = (id: string) => ({ GK0: 'Neuer', DEF3: 'Tah' })[id];

  it('Plural bei mehreren Auffüllern', () => {
    expect(fillerLabel(['GK0', 'DEF3'], names)).toBe(
      'Mit Ausfällen aufgefüllt: Neuer, Tah — kein einsatzfähiger Ersatz im Kader, zählen 0 Punkte.',
    );
  });

  it('fällt auf die Anzahl zurück, sobald ein Name fehlt — nie eine ID zeigen', () => {
    expect(fillerLabel(['GHOST'], names)).toContain('1 Platz');
    expect(fillerLabel(['GK0', 'GHOST'], names)).toContain('2 Plätze');
    expect(fillerLabel(['GK0', 'GHOST'], names)).not.toContain('GHOST');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MaxPerTeamRule } from '@/lineup/rules';
import { MaxPerTeamRuleCard } from './MaxPerTeamRuleCard';

function setup(rule: Partial<MaxPerTeamRule> = {}, leagueMax: number | null = null) {
  const onChange = vi.fn();
  render(
    <MaxPerTeamRuleCard
      rule={{ id: 'maxPerTeam', enabled: true, max: 3, ...rule } as MaxPerTeamRule}
      onChange={onChange}
      leagueMax={leagueMax}
    />,
  );
  return { onChange };
}

describe('MaxPerTeamRuleCard', () => {
  it('markiert den gültigen Wert hörbar, nicht nur farblich', () => {
    setup();
    // aria-pressed und nicht role="radio": eine echte radiogroup verlangt
    // Pfeiltasten-Navigation, die hier nicht implementiert ist.
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('meldet einen neuen Wert als Patch', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledWith({ max: 5 });
  });

  it('sperrt die Chips, solange die Regel aus ist', async () => {
    const { onChange } = setup({ enabled: false });

    const chip = screen.getByRole('button', { name: '5' });
    expect(chip).toBeDisabled();
    await userEvent.click(chip);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('schaltet die Regel über die Checkbox', async () => {
    const { onChange } = setup({ enabled: false });
    await userEvent.click(screen.getByRole('checkbox', { name: /Max. Spieler pro Verein/ }));
    expect(onChange).toHaveBeenCalledWith({ enabled: true });
  });

  it('nennt Kickbases eigenen Wert nur, wenn er abweicht', () => {
    const { unmount } = render(
      <MaxPerTeamRuleCard
        rule={{ id: 'maxPerTeam', enabled: true, max: 3 } as MaxPerTeamRule}
        onChange={vi.fn()}
        leagueMax={3}
      />,
    );
    expect(screen.queryByText(/Kickbase erlaubt/)).not.toBeInTheDocument();
    unmount();

    setup({}, 4);
    expect(screen.getByText(/max\. 4 pro Verein/)).toBeInTheDocument();
  });

  it('sagt, dass der Optimizer die Regel ignoriert, wenn sie aus ist', () => {
    setup({ enabled: false });
    expect(screen.getByText(/Optimizer ignoriert sie/)).toBeInTheDocument();
  });
});

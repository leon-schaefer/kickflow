import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SortChips } from './SortChips';

const options = [
  { key: 'marketValue', label: 'Marktwert' },
  { key: 'avgPoints', label: 'Ø Punkte' },
  { key: 'avgPerMillion', label: 'Ø-Punkte/Mio', dividerBefore: true },
] as const;

describe('SortChips', () => {
  it('markiert den aktiven Chip über aria-pressed', () => {
    render(<SortChips options={options} value="avgPoints" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Ø Punkte' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Marktwert' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('meldet den Schlüssel, nicht das Label', async () => {
    const onChange = vi.fn();
    render(<SortChips options={options} value="marketValue" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ø-Punkte/Mio' }));
    expect(onChange).toHaveBeenCalledWith('avgPerMillion');
  });

  it('stellt vorangestellte Chips vor die Sortierung', () => {
    render(
      <SortChips
        options={options}
        value="marketValue"
        onChange={vi.fn()}
        leading={<button type="button">Nur meine Gebote</button>}
      />,
    );
    const [first] = screen.getAllByRole('button');
    expect(first).toHaveTextContent('Nur meine Gebote');
  });
});

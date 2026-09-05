import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('meldet den Text, nicht das Event', async () => {
    const onChange = vi.fn();
    render(<TextField value="" onChange={onChange} aria-label="Suche" />);

    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('zeigt das X erst, wenn etwas drinsteht', () => {
    const { rerender } = render(<TextField value="" onChange={vi.fn()} aria-label="Suche" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<TextField value="Mus" onChange={vi.fn()} aria-label="Suche" />);
    expect(screen.getByRole('button', { name: 'Eingabe löschen' })).toBeInTheDocument();
  });

  it('leert das Feld und holt den Fokus zurück', async () => {
    const onChange = vi.fn();
    render(<TextField value="Mus" onChange={onChange} aria-label="Suche" />);

    await userEvent.click(screen.getByRole('button', { name: 'Eingabe löschen' }));

    expect(onChange).toHaveBeenCalledWith('');
    // Ohne das Zurückholen müsste man erst wieder hineinklicken, um nach dem
    // Leeren weiterzutippen — der Klick aufs X nimmt den Fokus schon beim
    // mousedown.
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('lässt das X beschriften', () => {
    render(<TextField value="1" onChange={vi.fn()} clearLabel="Gebot löschen" aria-label="Gebot" />);
    expect(screen.getByRole('button', { name: 'Gebot löschen' })).toBeInTheDocument();
  });

  it('zeigt kein X in einem nicht editierbaren Feld', () => {
    const { rerender } = render(
      <TextField value="1" onChange={vi.fn()} disabled aria-label="Gebot" />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<TextField value="1" onChange={vi.fn()} readOnly aria-label="Gebot" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reicht Eingabe-Props ans input durch', () => {
    render(
      <TextField
        value=""
        onChange={vi.fn()}
        aria-label="Gebot"
        inputMode="numeric"
        placeholder="0"
      />,
    );
    // Ersatz für keyboardType="number-pad".
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
  });

  it('rendert das Suffix neben dem Feld', () => {
    render(<TextField value="1" onChange={vi.fn()} aria-label="Gebot" suffix={<span>€</span>} />);
    expect(screen.getByText('€')).toBeInTheDocument();
  });
});

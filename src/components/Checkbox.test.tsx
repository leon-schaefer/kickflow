import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('ist ein echtes Kontrollkästchen und kein nachgebauter Button', () => {
    render(<Checkbox label="Nur eigene" checked={false} onChange={() => {}} />);

    // Die React-Native-Fassung war ein Pressable mit handgemachtem Häkchen.
    // Das echte Input bringt Rolle, Zustand und Tastatur ohne ARIA mit.
    const box = screen.getByRole('checkbox', { name: 'Nur eigene' });
    expect(box).not.toBeChecked();
  });

  it('meldet den neuen Zustand beim Klick', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Nur eigene" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('meldet false, wenn es schon gesetzt war', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Nur eigene" checked onChange={onChange} />);

    expect(screen.getByRole('checkbox')).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('ist per Tastatur bedienbar', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Nur eigene" checked={false} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reagiert nicht, wenn es deaktiviert ist', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Nur eigene" checked={false} onChange={onChange} disabled />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('zeigt den Hinweistext', () => {
    render(
      <Checkbox label="Nur eigene" checked={false} onChange={() => {}} hint="Braucht einen Kader" />,
    );
    expect(screen.getByText('Braucht einen Kader')).toBeInTheDocument();
  });
});

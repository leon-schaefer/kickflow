import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBannerView } from './UpdateBannerView';

describe('UpdateBannerView', () => {
  it('bleibt eine Schaltfläche und ist trotzdem eine Live-Region', () => {
    render(<UpdateBannerView onClick={() => {}} />);
    // role="alert" am Button selbst hätte die Button-Rolle verdrängt.
    expect(screen.getByRole('button', { name: /Neue Version/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('lädt erst auf Tap neu, nicht von selbst', async () => {
    const onClick = vi.fn();
    render(<UpdateBannerView onClick={onClick} />);
    // Ein Auto-Reload könnte mitten in einer ungespeicherten Aufstellung
    // zuschlagen — deshalb hängt das Neuladen an genau diesem Klick.
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

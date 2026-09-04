import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlayerRowFrame, PlayerStatColumn } from './PlayerRowFrame';

/**
 * Der Rahmen ist bewusst ein `div role="button"` und kein `<button>`, weil
 * MarketRow eine Bieten-Pille in den rechten Slot schiebt. Das kostet die
 * eingebaute Tastaturbedienung — deshalb steht sie hier von Hand drin, und
 * deshalb ist sie hier getestet.
 */
function setup({ onClick }: { onClick?: () => void } = {}) {
  render(
    <PlayerRowFrame
      position="MID"
      imageUrl="https://kickbase.test/p.png"
      onClick={onClick}
      right={<PlayerStatColumn cells={[{ value: '12,3 Mio' }]} />}
    >
      <span>Musiala</span>
    </PlayerRowFrame>,
  );
}

describe('PlayerRowFrame', () => {
  it('trägt die Position als Attribut, nicht als Farbe im JavaScript', () => {
    setup({ onClick: () => {} });
    // Ersetzt `${positionColors[position]}26` — die Farbe kommt über
    // data-position aus theme/positions.css.
    expect(screen.getByRole('button')).toHaveAttribute('data-position', 'MID');
    expect(screen.getByText('MF')).toBeInTheDocument();
  });

  it('ist ohne onClick keine Schaltfläche und nicht fokussierbar', () => {
    setup();
    // Die Kader-Zeile ohne Tap-Handler soll nicht im Tab-Fokus liegen.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reagiert auf Klick', async () => {
    const onClick = vi.fn();
    setup({ onClick });
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['{Enter}', 'Enter'],
    [' ', 'Leerzeichen'],
  ])('lässt sich per Tastatur auslösen (%s)', async (key) => {
    const onClick = vi.fn();
    setup({ onClick });
    // Ein echter <button> täte das selbst; hier hängt es an handleKeyDown.
    screen.getByRole('button').focus();
    await userEvent.keyboard(key);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hält das Spielerbild aus dem Layoutfluss heraus, wenn es fehlt', () => {
    const { container } = render(
      <PlayerRowFrame position="GK" imageUrl={null} right={null}>
        <span>Neuer</span>
      </PlayerRowFrame>,
    );
    // Kein <img> ohne src (der Browser zeigte sonst ein Bruchbild), aber ein
    // Platzhalter gleicher Größe, damit die Zeile nicht springt.
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('PlayerStatColumn', () => {
  it('setzt tone als Attribut statt einer Farb-Map', () => {
    render(<PlayerStatColumn cells={[{ value: '0,42', label: 'Ø/Mio', tone: 'accent' }]} />);
    expect(screen.getByText('0,42')).toHaveAttribute('data-tone', 'accent');
    expect(screen.getByText('Ø/Mio')).toBeInTheDocument();
  });

  it('lässt tone weg, wenn keiner gesetzt ist', () => {
    render(<PlayerStatColumn cells={[{ value: '12,3 Mio' }]} />);
    // Ohne Attribut greift der Fallback var(--tone, --color-text-primary).
    expect(screen.getByText('12,3 Mio')).not.toHaveAttribute('data-tone');
  });

  it('rendert den Footer-Slot', () => {
    render(
      <PlayerStatColumn
        cells={[{ value: '1' }]}
        footer={<button type="button">Bieten</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Bieten' })).toBeInTheDocument();
  });
});

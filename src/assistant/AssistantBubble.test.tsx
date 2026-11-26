import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AssistantBubble } from './AssistantBubble';

vi.mock('./LeagueAssistantDialog', () => ({
  default: () => <div>Chat geöffnet</div>,
}));

it('moves a dragged bubble inside its bounds and opens it only on a subsequent click', async () => {
  render(<AssistantBubble target={null} />);
  const bubble = screen.getByRole('button', { name: 'KI-Transferassistent öffnen' });
  vi.spyOn(bubble, 'getBoundingClientRect').mockReturnValue(new DOMRect(256, 356, 44, 44));
  vi.spyOn(bubble.parentElement!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 400));
  Object.defineProperty(bubble, 'setPointerCapture', { value: vi.fn() });

  const pointer = { pointerId: 1, isPrimary: true, button: 0 };
  fireEvent.pointerDown(bubble, { ...pointer, clientX: 270, clientY: 370 });
  fireEvent.pointerMove(bubble, { ...pointer, clientX: -10, clientY: 180 });
  fireEvent.pointerUp(bubble, { ...pointer, clientX: -10, clientY: 180 });
  fireEvent.click(bubble, { detail: 1 });

  expect(bubble.style.left).toBe('0%');
  expect(Number.parseFloat(bubble.style.top)).toBeCloseTo(46.63);
  expect(screen.queryByText('Chat geöffnet')).toBeNull();

  fireEvent.pointerDown(bubble, { ...pointer, clientX: 12, clientY: 175 });
  fireEvent.pointerUp(bubble, { ...pointer, clientX: 12, clientY: 175 });
  fireEvent.click(bubble, { detail: 1 });
  expect(await screen.findByText('Chat geöffnet')).toBeVisible();
});

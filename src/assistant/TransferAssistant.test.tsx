import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { assistantChatKey, openRouterKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { TransferAssistant } from './TransferAssistant';
import { askTransferAssistant } from './openRouter';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ userId: 'manager' }) }));
vi.mock('./usePlayerLookup', () => ({ usePlayerLookup: () => vi.fn() }));
vi.mock('./openRouter', () => ({ askTransferAssistant: vi.fn() }));

afterEach(() => localStore.clearAppData());

function chat(leagueId: string, open = true, onClose = () => {}) {
  return (
    <MemoryRouter>
      <TransferAssistant
        open={open}
        leagueId={leagueId}
        competitionId={null}
        getContext={() => ({
          squad: [],
          market: [],
          matchday: null,
          deadlineMinutes: null,
          formation: '4-4-2',
          balance: null,
          budgetLimit: null,
          metric: 'expectedPoints',
          maxStartersPerClub: null,
          squadGaps: [],
          blockedByRule: [],
          sellPlan: null,
        })}
        onClose={onClose}
      />
    </MemoryRouter>
  );
}


it('restores answers and the draft for the same league and clears them on reset', async () => {
  const user = userEvent.setup();
  vi.mocked(askTransferAssistant).mockResolvedValue('Prüfe zuerst dein Budget.');
  await localStore.setItem(openRouterKey('42'), 'test-key');
  const dialog = render(chat('42'));
  await user.type(screen.getByLabelText('Deine Transferfrage'), 'Wen kaufen?');
  await user.click(screen.getByRole('button', { name: 'Frage senden' }));
  await screen.findByText('Prüfe zuerst dein Budget.');
  await user.type(screen.getByLabelText('Deine Transferfrage'), 'Und wen verkaufen?');
  dialog.unmount();

  const otherLeague = render(chat('43'));
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('');
  expect(screen.queryByRole('log')).toBeNull();
  otherLeague.unmount();

  render(chat('42'));
  expect(screen.getByText('Prüfe zuerst dein Budget.')).toBeVisible();
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('Und wen verkaufen?');
  await user.click(screen.getByRole('button', { name: 'Chat zurücksetzen' }));
  expect(localStore.getItemSync(assistantChatKey('42', 'manager'))).toBeNull();
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('');
  expect(localStore.getItemSync(openRouterKey('42'))).toBe('test-key');
});

it('finishes a pending request with the dialog closed and restores the answer on reopen', async () => {
  const user = userEvent.setup();
  await localStore.setItem(openRouterKey('42'), 'test-key');
  const response = Promise.withResolvers<string>();
  vi.mocked(askTransferAssistant).mockReturnValueOnce(response.promise);
  const dialog = render(chat('42', true, () => dialog.rerender(chat('42', false))));

  await user.type(screen.getByLabelText('Deine Transferfrage'), 'Wen verkaufen?');
  await user.click(screen.getByRole('button', { name: 'Frage senden' }));
  expect(screen.getByText('GPT-6 Luna antwortet …')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Schließen' }));
  expect(screen.queryByRole('dialog')).toBeNull();

  await act(async () => response.resolve('Verkaufe zuerst einen Bankspieler.'));
  expect(localStore.getItemSync(assistantChatKey('42', 'manager'))).toContain('Verkaufe zuerst einen Bankspieler.');
  dialog.rerender(chat('42'));
  expect(screen.getByText('Verkaufe zuerst einen Bankspieler.')).toBeVisible();
});

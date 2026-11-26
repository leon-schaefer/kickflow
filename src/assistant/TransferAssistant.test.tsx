import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { assistantChatKey, openRouterKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { TransferAssistant } from './TransferAssistant';
import { askTransferAssistant } from './openRouter';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ userId: 'manager' }) }));
vi.mock('./usePlayerLookup', () => ({ usePlayerLookup: () => vi.fn() }));
vi.mock('./openRouter', () => ({ askTransferAssistant: vi.fn() }));

afterEach(() => localStore.clearAppData());

it('restores answers and the draft for the same league and clears them on reset', async () => {
  const user = userEvent.setup();
  vi.mocked(askTransferAssistant).mockResolvedValue('Prüfe zuerst dein Budget.');
  await localStore.setItem(openRouterKey('42'), 'test-key');
  const renderChat = (leagueId: string) => render(
    <TransferAssistant
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
      onClose={() => {}}
    />,
  );

  const dialog = renderChat('42');
  await user.type(screen.getByLabelText('Deine Transferfrage'), 'Wen kaufen?');
  await user.click(screen.getByRole('button', { name: 'Frage senden' }));
  await screen.findByText('Prüfe zuerst dein Budget.');
  await user.type(screen.getByLabelText('Deine Transferfrage'), 'Und wen verkaufen?');
  dialog.unmount();

  const otherLeague = renderChat('43');
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('');
  expect(screen.queryByRole('log')).toBeNull();
  otherLeague.unmount();

  renderChat('42');
  expect(screen.getByText('Prüfe zuerst dein Budget.')).toBeVisible();
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('Und wen verkaufen?');
  await user.click(screen.getByRole('button', { name: 'Chat zurücksetzen' }));
  expect(localStore.getItemSync(assistantChatKey('42', 'manager'))).toBeNull();
  expect(screen.getByLabelText('Deine Transferfrage')).toHaveValue('');
  expect(screen.getByLabelText('OpenRouter-API-Schlüssel')).toHaveValue('test-key');
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '@/api/kickbase';
import { SESSION_KEY } from '@/storage/keys';
import { AuthProvider, useAuth } from './AuthProvider';

const kickbaseLogin = vi.hoisted(() => vi.fn());
vi.mock('@/api/kickbase', () => ({ login: kickbaseLogin }));

const session: AuthSession = {
  token: 'neu',
  refreshToken: 'refresh',
  userId: '42',
  userName: 'Ich',
};

function Probe() {
  const { token, userId, userName, login, logout } = useAuth();
  return (
    <>
      <p>
        token={token === undefined ? 'lädt' : (token ?? 'keiner')} userId={userId ?? 'keine'}{' '}
        userName={userName ?? 'keiner'}
      </p>
      <button type="button" onClick={() => void login('a@b.c', 'pw')}>
        Anmelden
      </button>
      <button type="button" onClick={() => void logout()}>
        Abmelden
      </button>
    </>
  );
}

function setup() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  kickbaseLogin.mockReset();
  kickbaseLogin.mockResolvedValue(session);
});

describe('AuthProvider', () => {
  it('holt die eigene Identität beim Start aus dem Store zurück', async () => {
    // Der Fehler, um den es geht: lagen `userId`/`userName` nur im State, war
    // nach jedem Reload nur noch der Token da — der Liga-Tab zeigte dann
    // weder die eigene Zeile noch das Duell (siehe LeagueScreen).
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: 'alt', refreshToken: null, userId: '42', userName: 'Ich' }),
    );
    setup();

    expect(await screen.findByText(/userId=42/)).toBeInTheDocument();
    expect(screen.getByText(/userName=Ich/)).toBeInTheDocument();
  });

  it('bleibt bei einer Session ohne Identität angemeldet', async () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'alt', refreshToken: null }));
    setup();

    expect(await screen.findByText(/token=alt/)).toBeInTheDocument();
    expect(screen.getByText(/userId=keine/)).toBeInTheDocument();
  });

  it('schreibt die Identität beim Login mit in den Store', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByText(/userId=42/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY)!)).toEqual({
      token: 'neu',
      refreshToken: 'refresh',
      userId: '42',
      userName: 'Ich',
    });
  });

  it('lässt beim Abmelden nichts von der Identität zurück', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    await screen.findByText(/userId=42/);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByText(/userId=keine/)).toBeInTheDocument();
    expect(screen.getByText(/userName=keiner/)).toBeInTheDocument();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

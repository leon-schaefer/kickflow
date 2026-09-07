import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { queryClient } from '@/queries/queryClient';
import { routes } from '@/routes/routes';
import { SESSION_KEY } from '@/storage/keys';

interface RenderRouteOptions {
  /** false = kein Login im Speicher, das Gate muss dann umleiten. */
  session?: boolean;
}

/**
 * Mountet den echten Route-Baum an einer URL — der einzige Einstieg für
 * Route-Tests.
 *
 * `createMemoryRouter` statt `createBrowserRouter`, damit kein Test an
 * `window.location` fummelt und jeder mit einer sauberen History startet.
 *
 * Zwei Stolpersteine, die hier einmal richtig stehen:
 *
 *  - `queryClient` ist ein Modul-Singleton, den `AuthProvider` direkt
 *    importiert (für `clear()` beim An- und Abmelden). Ein Test kann also
 *    keinen frischen Client injizieren, ohne den Provider umzubauen — statt
 *    dessen wird der eine Client hier zurückgesetzt.
 *  - Ohne `retry: false` wartet jeder Fehlerpfad-Test eine Retry-Runde ab und
 *    produziert act-Warnungen. Das ist die klassische Quelle wackeliger
 *    Suites.
 */
export function renderRoute(path: string, { session = true }: RenderRouteOptions = {}) {
  if (session) {
    // Vollständige Session, wie sie der tokenStore schreibt — inklusive
    // Identität: an ihr hängt im Liga-Tab die eigene Zeile samt Duell.
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: 'test-token',
        refreshToken: null,
        userId: 'test-user',
        userName: 'Test',
      }),
    );
  }

  queryClient.clear();
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  });

  const router = createMemoryRouter(routes, { initialEntries: [path] });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { ...result, router };
}

import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { queryClient } from '@/queries/queryClient';
import { routes } from '@/routes/routes';

/**
 * Provider-Baum. Vier Provider der Expo-Fassung fallen weg:
 * `ObserveRoot` (EAS-Telemetrie, ersatzlos gestrichen),
 * `GestureHandlerRootView`, `SafeAreaProvider` (jetzt CSS `env()`) und
 * `ThemeProvider` (jetzt CSS Custom Properties).
 *
 * `AuthProvider` liegt bewusst ÜBER dem Router: das Gate liest den Token als
 * Route-Element, und der 401-Bus (queryClient -> unauthorizedBus ->
 * AuthProvider -> Token null) kommt ohne Router-Kenntnis aus. Genau deshalb
 * ist diese Kette unverändert übernehmbar.
 */
const router = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

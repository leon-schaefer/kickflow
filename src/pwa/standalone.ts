/**
 * Läuft die App vom Startbildschirm statt in einem Browser-Tab?
 *
 * Zwei Wege, dieselbe Frage: `display-mode: standalone` beantwortet sie in
 * Chromium und im modernen Safari, `navigator.standalone` ist der ältere
 * WebKit-Weg und trägt iOS-Versionen, die das Media-Feature nicht kennen.
 * Fehlt einer der beiden, hielte die App eine installierte PWA für einen Tab.
 *
 * Zwei Aufrufer, und beide würden am selben Fehler scheitern: der
 * Installations-Hinweis (useInstallHint.ts) böte an, was schon geschehen ist,
 * und die Startseite (src/routes/IndexRoute.tsx) zeigte einem installierten
 * Nutzer die Werbeseite statt des Logins.
 */
export function isStandalone(): boolean {
  const legacy = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (legacy === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

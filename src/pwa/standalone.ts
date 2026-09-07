/**
 * Läuft die App als installierte PWA oder in einem Browser-Tab?
 *
 * Zwei Wege, dieselbe Frage: `display-mode: standalone` beantwortet sie in
 * Chromium und im modernen Safari, `navigator.standalone` ist der ältere
 * WebKit-Weg und trägt iOS-Versionen, die das Media-Feature nicht kennen.
 * Fehlt einer der beiden, hielte die App eine installierte PWA für einen Tab
 * und böte an, was dort schon geschehen ist.
 *
 * Liegt in einer eigenen Datei, weil es zwei Konsumenten mit ganz
 * verschiedenen Anliegen gibt: der Installationshinweis entscheidet daran, ob
 * er überhaupt erscheint (src/pwa/useInstallHint.ts), und das Feedback-
 * Formular schreibt die Antwort in die technischen Angaben der Mail
 * (src/support/feedback.ts) — dort ist sie die halbe Diagnose, weil das
 * iOS-Statusband und die Safe-Area-Abstände nur in der installierten PWA
 * greifen (siehe AGENTS.md).
 */
export function isStandalone(): boolean {
  const legacy = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (legacy === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

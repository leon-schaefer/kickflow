import { config } from 'zod';

/**
 * Schaltet Zods JIT-Kompilierung ab — als Seiteneffekt-Modul, das VOR allem
 * anderen importiert werden muss.
 *
 * Zod v4 kompiliert Validatoren zur Laufzeit mit `new Function` und prüft
 * vorher per `try/catch`, ob das erlaubt ist. Die CSP in vercel.json erlaubt
 * `script-src 'self'` ohne `'unsafe-eval'` — der Aufruf wird also blockiert,
 * der `catch` greift, und Zod läuft ohnehin im Interpreter-Modus. Der Browser
 * meldet die abgefangene Ausnahme trotzdem als `securitypolicyviolation`,
 * einmal pro Seitenaufruf. Zod dokumentiert genau das in
 * `zod/src/v4/core/util.ts` und kürzt die Probe unter `jitless` ab.
 *
 * Wirkung also: kein Verhaltens- und kein Geschwindigkeitsunterschied — wir
 * waren schon jitless —, aber der Verstoß verschwindet und der Zustand ist
 * gewollt statt zufällig. Nachgewiesen mit einem Deep-Link-Lauf gegen das
 * gebaute Artefakt unter der echten CSP.
 *
 * Die Alternative wäre `'unsafe-eval'` in der CSP. Das ist keine: `script-src
 * 'self'` ohne Inline und ohne eval trägt die Sicherheitsargumentation für
 * das Token im localStorage (siehe src/auth/tokenStore.ts).
 *
 * Zod merkt sich die Antwort beim ersten Zugriff (`cached()`), deshalb die
 * strikte Reihenfolge: dieser Import steht in src/main.tsx ganz oben, vor dem
 * Import von App — sonst wäre die Konfiguration zu spät.
 */
config({ jitless: true });

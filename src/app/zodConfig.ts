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
 * Zod merkt sich die Antwort beim ersten Zugriff (`cached()`), es kommt also
 * strikt auf die Reihenfolge an: `config()` muss laufen, BEVOR irgendwo das
 * erste Schema gebaut wird.
 *
 * ## Warum der Import in main.tsx dafür NICHT genügt
 *
 * Er hat es getan, solange die App EIN Bundle war: dort folgte die
 * Auswertungsreihenfolge der Importkette, und `import '@/app/zodConfig'` stand
 * in main.tsx ganz oben — also vor allem, was Schemata baut.
 *
 * Mit dem Route-Splitting (`lazy()` in src/routes/routes.tsx) stimmt das nicht
 * mehr. Rolldown legt die API-Schicht samt zod in einen GETEILTEN Chunk, und
 * ein geteilter Chunk ist ein ESM-Modul, das der Browser vor dem Body des
 * Entry-Chunks auswertet. `config({ jitless: true })` lief damit NACH dem
 * ersten `z.looseObject(...)` in schemas.ts — der Verstoß war zurück, genau
 * einmal pro Seitenaufruf, und im Browser sichtbar nur als Eintrag in der
 * Konsole.
 *
 * Deshalb ist der Vertrag jetzt eine echte MODULABHÄNGIGKEIT und keine
 * Konvention über Zeilenreihenfolge: jedes Modul, das `z` benutzt
 * (api/kickbase/schemas.ts, lineup/rules.ts, lineup/excludedFromSale.ts),
 * importiert diese Datei selbst und zwar vor zod. Wo der Bundler die Module
 * auch hinlegt — dieser Seiteneffekt liegt davor. Der Import in main.tsx
 * bleibt zusätzlich stehen, damit die Konfiguration auch dann gesetzt ist,
 * wenn irgendwann direkt aus einer Komponente heraus ein Schema entsteht.
 *
 * Bewacht von zodConfig.test.ts, das die Importe im Quelltext nachprüft. Der
 * Verstoß selbst ist nur im echten Browser unter der echten CSP sichtbar —
 * jsdom hat keine CSP, und der Build bleibt grün.
 */
config({ jitless: true });

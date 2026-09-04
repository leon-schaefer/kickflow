/// <reference types="vite/client" />

/*
 * Warum die Triple-Slash-Referenz und nicht `"types": ["vite/client"]` in der
 * tsconfig: dort steht `"types": ["node"]`, was die AUTOMATISCHE Einbindung
 * von @types-Paketen auf `node` beschränkt. Ein zusätzlicher Eintrag würde
 * gehen, aber die Referenz hier hält die Zuständigkeit bei der Datei, die die
 * Deklarationen ohnehin erweitert.
 */

/**
 * Von `define` in vite.config.ts zur Build-Zeit ersetzt — der Ersatz für
 * `Constants.expoConfig?.version` und `?.extra?.gitSha` aus expo-constants
 * (siehe Mehr-Tab).
 *
 * `__GIT_SHA__` ist `null`, wenn kein verwertbarer Git-Kontext da war: kein
 * VERCEL_GIT_COMMIT_SHA und kein `git rev-parse` (Export aus einem Tarball),
 * oder ein Platzhalterwert, wie Vercel ihn in manchen Preview-Deploys setzt.
 */
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string | null;

interface ImportMetaEnv {
  /**
   * Ziel der Unterstützen-Karte im Mehr-Tab. Muss mit `https://` beginnen,
   * sonst wird sie verworfen; nicht gesetzt heißt, die Karte erscheint nicht.
   *
   * Hieß unter Expo `EXPO_PUBLIC_SUPPORT_URL`. Wie dort gilt: der Wert wird
   * zur Build-Zeit eingebacken und ist damit öffentlich.
   */
  readonly VITE_SUPPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

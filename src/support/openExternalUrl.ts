/**
 * Generischer Re-Export, existiert nur für TypeScript/Tooling (tsc, vitest),
 * die Metros Plattform-Auflösung (.web.ts / .native.ts) nicht kennen.
 * Metro selbst bevorzugt beim Bundling immer die plattformspezifische Datei
 * und lädt diese Datei nie tatsächlich — siehe openExternalUrl.web.ts /
 * openExternalUrl.native.ts. Vorbild: src/auth/tokenStore.ts.
 */
export * from './openExternalUrl.web';

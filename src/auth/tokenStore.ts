/**
 * Generischer Re-Export, existiert nur für TypeScript/Tooling (tsc, vitest),
 * die Metros Plattform-Auflösung (.web.ts / .native.ts) nicht kennen.
 * Metro selbst bevorzugt beim Bundling immer die plattformspezifische Datei
 * und lädt diese Datei nie tatsächlich — siehe tokenStore.web.ts / tokenStore.native.ts.
 */
export * from './tokenStore.web';

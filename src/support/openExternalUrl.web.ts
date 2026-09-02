/**
 * Web-Implementierung: öffnet einen neuen Tab.
 *
 * Bewusst nicht `Linking.openURL` aus expo-linking — dessen Web-Variante
 * (node_modules/expo-linking/build/RNLinking.web.js) setzt schlicht
 * `window.location` und navigiert damit das *aktuelle* Tab weg. In der
 * installierten PWA (`"display": "standalone"` in public/manifest.webmanifest)
 * gibt es dann weder Adressleiste noch Zurück-Pfeil: der Nutzer säße auf der
 * fremden Seite fest und müsste die App neu starten.
 *
 * `noopener,noreferrer`: die geöffnete Seite bekommt keinen `window.opener`
 * auf die App und keinen Referrer (passt zur Referrer-Policy `no-referrer`
 * aus vercel.json). Der Rückgabewert wird absichtlich nicht geprüft — mit
 * `noopener` liefert `window.open` laut HTML-Spec immer `null`, ein
 * blockiertes Popup ließe sich daran also gar nicht erkennen.
 */
export async function openExternalUrl(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
}

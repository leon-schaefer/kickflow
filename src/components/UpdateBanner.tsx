import { useEffect, useState } from 'react';
import { UpdateBannerView } from './UpdateBannerView';

/**
 * `public/register-sw.js` holt periodisch (Intervall + Tab-Fokus) die
 * `/build-id.txt` des Deployments und vergleicht sie mit der ID, die beim
 * ersten erfolgreichen Abruf galt — siehe Kommentar dort, warum der reguläre
 * Service-Worker-Update-Lifecycle dafür nicht taugt. Sobald sie abweichen,
 * feuert es `kickflow:update-available` auf `window`.
 *
 * Reload passiert ausschließlich auf Tap, nie automatisch — ein Auto-Reload
 * könnte mitten in einer ungespeicherten Aufstellungsbearbeitung zuschlagen.
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    function handleUpdate() {
      setUpdateAvailable(true);
    }
    window.addEventListener('kickflow:update-available', handleUpdate);
    return () => window.removeEventListener('kickflow:update-available', handleUpdate);
  }, []);

  if (!updateAvailable) return null;

  return <UpdateBannerView onPress={() => window.location.reload()} />;
}

import { useEffect, useState } from 'react';
import { UpdateBannerView } from './UpdateBannerView';

/**
 * `public/register-sw.js` vergleicht periodisch (Intervall + Tab-Fokus) den
 * Hash des geladenen JS-Bundles gegen den einer frisch vom Server geholten
 * index.html — siehe Kommentar dort, warum der reguläre
 * Service-Worker-Update-Lifecycle dafür nicht taugt. Sobald sie abweichen,
 * feuert es `kickflow:update-available` auf `window`.
 *
 * Reload passiert ausschließlich auf Tap, nie automatisch — ein Auto-Reload
 * könnte mitten in einer unges­pei­cherten Aufstellungsbearbeitung zuschlagen.
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

// MUSS als erstes stehen: konfiguriert Zod, bevor irgendein Schema-Modul
// geladen wird. Begründung und Reihenfolge-Vertrag in der Datei selbst.
import '@/app/zodConfig';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { startResumeGuard } from '@/pwa/resumeGuard';
import { hideStalledNotice, showStalledNotice } from '@/pwa/stalledNotice';
import '@/theme/base.css';
import '@/theme/tokens.css';
import '@/theme/positions.css';

/**
 * Einstiegspunkt. Ersetzt `main: "expo-router/entry"` aus der package.json,
 * das die Routen per Metro-`require.context` aus `app/` gescannt hat.
 *
 * Die drei globalen Stylesheets kommen hier und nur hier: base.css setzt
 * border-box, tokens.css legt die Custom Properties auf `:root`,
 * positions.css die Attribut-Selektoren. Alles andere sind CSS-Module und
 * werden von ihren Komponenten importiert.
 */
const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Neben React und nicht darin: der Wächter muss noch arbeiten, wenn React
 * nach der Rückkehr aus dem Hintergrund nichts mehr rendert — und genau das
 * ist sein Fall. Die ausgemessene Begründung steht in
 * src/pwa/resumeGuard.ts.
 *
 * Kein `stop()` aufgehoben: der Wächter lebt so lange wie das Dokument. Die
 * Abmeldung gibt es für die Tests.
 */
startResumeGuard({
  onStalled: () => showStalledNotice(() => window.location.reload()),
  onRecovered: hideStalledNotice,
});

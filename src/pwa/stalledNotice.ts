import styles from './stalledNotice.module.css';

/**
 * Der Hinweis, den der Wächter aus resumeGuard.ts zeigt, wenn React nach der
 * Rückkehr aus dem Hintergrund nicht mehr rendert.
 *
 * Bewusst OHNE React aufgebaut, und das ist der ganze Witz dieser Datei: in
 * dem Zustand, für den sie gedacht ist, kommt kein React-Render mehr durch
 * (Begründung in resumeGuard.ts). Ein `<UpdateBannerView>` wäre hier also
 * genau das Falsche — er würde nie sichtbar.
 *
 * Was er trotzdem von React-Komponenten übernimmt, ist das Aussehen: die
 * Klassen kommen aus einem CSS-Modul wie überall sonst, das im schon
 * geladenen Stylesheet steckt. Getroffen wird damit dieselbe Optik wie beim
 * Update-Banner, ohne dass hier Inline-Styles die Tokens nachbauen müssten.
 *
 * `role="alert"` sitzt wie dort am Rahmen und nicht am Button: am Button
 * würde er dessen Rolle verdrängen, und der Hinweis wäre nicht mehr als
 * Schaltfläche angekündigt.
 */
const FRAME_ID = 'kickflow-stalled-notice';

export const STALLED_NOTICE_TEXT = 'kickflow reagiert nicht mehr — antippen zum Neuladen';

/** Idempotent: steht der Hinweis schon, bleibt er unverändert stehen. */
export function showStalledNotice(onReload: () => void): void {
  if (document.getElementById(FRAME_ID)) return;

  /*
   * Steht gerade ein Modal offen, ist der Rest des Dokuments inert — ein
   * Hinweis an `document.body` wäre sichtbar, aber nicht antippbar. Im
   * Top-Layer des offenen Dialogs ist er beides. Alle Modale der App liegen
   * als `dialog[open]` an `document.body` (src/components/Modal.tsx), es gibt
   * also genau einen Kandidaten.
   */
  const host = document.querySelector('dialog[open]') ?? document.body;

  const frame = document.createElement('div');
  frame.id = FRAME_ID;
  frame.className = styles.frame;
  frame.setAttribute('role', 'alert');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = styles.banner;
  button.textContent = STALLED_NOTICE_TEXT;
  // `click` und nicht `pointerdown`: der Nutzer soll bewusst tippen und nicht
  // beim Wischen versehentlich neu laden. Ein nativer Listener genügt — was
  // ausfällt, ist React, nicht der Browser.
  button.addEventListener('click', onReload);

  frame.appendChild(button);
  host.appendChild(frame);
}

export function hideStalledNotice(): void {
  document.getElementById(FRAME_ID)?.remove();
}

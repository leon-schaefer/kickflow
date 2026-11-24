/**
 * Pfad und Titel des Statistik-Screens an EINER Stelle — dieselbe Rolle wie
 * legalRoutes.ts für die Rechtsseiten, und aus demselben Grund eine eigene,
 * winzige Datei: den Titel direkt aus `StatsScreen.tsx` zu importieren würde
 * den `lazy()`-Schnitt im Route-Baum aufheben und den ganzen Screen samt
 * Auswertung in den Routen-Chunk ziehen.
 *
 * Benutzt wird das Paar an drei Stellen: der Route (`handle.title`), der
 * Kopfzeile des Screens und dem Link im Aufstellungs-Tab, der hierher führt —
 * letzterer gibt den Titel als Herkunft mit, damit „Zurück" ihn anzeigt.
 */
export const STATS_SEGMENT = 'stats';

export const STATS_TITLE = 'Statistiken';

export function statsPath(leagueId: string): string {
  return `/${leagueId}/${STATS_SEGMENT}`;
}

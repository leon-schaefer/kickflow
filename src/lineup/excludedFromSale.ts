// MUSS vor dem zod-Import stehen: schaltet Zods JIT ab, bevor hier das
// erste Schema gebaut wird. Nicht optional und kein Duplikat der Zeile in
// main.tsx — Begründung im Kopf von src/app/zodConfig.ts.
import '@/app/zodConfig';
import { z } from 'zod';

/**
 * Vom Verkauf ausgeschlossene Kaderspieler ("Nicht verkaufen") — eine reine
 * Nutzerentscheidung, die Kickbase selbst nicht kennt und die deshalb lokal
 * pro Liga persistiert wird (siehe useExcludedFromSale.ts).
 *
 * Wirkung ausschließlich auf der VERKAUFS-Seite: der Verkaufsvorschlag
 * (utils/sellAdvice.ts) schlägt sie nie zum Verkauf vor, und der
 * Kontoausgleich (utils/sellPlan.ts) darf sie nicht einplanen. Die
 * Aufstellungs-Optimierung selbst bleibt unberührt — ein ausgeschlossener
 * Spieler steht in der Elf, wenn er sportlich hingehört.
 *
 * Bewusst nur IDs: der Kader kommt bei jedem Laden frisch von Kickbase, ein
 * mitgespeicherter Name/Marktwert wäre sofort veraltet. IDs verkaufter
 * Spieler bleiben stehen und laufen ins Leere — harmlos, und ein Rückkauf
 * stellt den Ausschluss wieder her.
 */

const storedSchema = z.array(z.string());

/** Liest gespeicherte Ausschlüsse; bei fehlendem/kaputtem Wert eine leere Menge statt eines Crashs. */
export function parseStoredExclusions(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? new Set(parsed.data) : new Set();
  } catch {
    return new Set();
  }
}

/** Sortiert serialisiert, damit derselbe Zustand denselben Storage-Wert ergibt. */
export function serializeExclusions(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}

/** Neue Menge mit umgeschaltetem Eintrag — nie in-place, der State ist Teil eines useState. */
export function toggleExclusion(ids: ReadonlySet<string>, playerId: string): Set<string> {
  const next = new Set(ids);
  if (!next.delete(playerId)) next.add(playerId);
  return next;
}

/** Leere Menge als geteilte Konstante — stabile Referenz für Default-Parameter und Memo-Deps. */
export const NO_EXCLUSIONS: ReadonlySet<string> = new Set<string>();

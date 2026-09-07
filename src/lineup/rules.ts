// MUSS vor dem zod-Import stehen: schaltet Zods JIT ab, bevor hier das
// erste Schema gebaut wird. Nicht optional und kein Duplikat der Zeile in
// main.tsx — Begründung im Kopf von src/app/zodConfig.ts.
import '@/app/zodConfig';
import { z } from 'zod';

/**
 * Liga-eigene Regeln, an die sich der Aufstellungs-Optimizer hält (siehe
 * src/utils/constrainedLineup.ts). Diskriminierte Union über `kind`, damit
 * ein neuer Regeltyp nur ein Union-Member + ein Zweig in `toConstraints` +
 * eine UI-Zeile ist. Aktuell ein Typ: maximal X Spieler desselben Vereins in
 * der Elf, uniform für alle Vereine (kein Verein wird namentlich konfiguriert).
 *
 * Regeln sind hart — solange aktiv, werden sie nie verletzt. Zwei getrennte
 * Wege, eine Regel unwirksam zu machen: `enabled: false` (dauerhaft, hier
 * persistiert) und das Session-only "ignorieren" in useLineupOptimizer.ts
 * (siehe dort), das die Konfiguration NICHT verändert.
 */
export interface MaxPerTeamRule {
  kind: 'maxPerTeam';
  /** Stabile ID — trägt die Blocker-Diagnose und das Session-"Ignorieren". */
  id: 'maxPerTeam';
  enabled: boolean;
  /** 1..11 Spieler desselben Vereins. */
  max: number;
}

export type LineupRule = MaxPerTeamRule;

/** Vor der ersten eigenen Einstellung bzw. bei kaputtem Storage-Wert. */
export const DEFAULT_RULES: LineupRule[] = [{ kind: 'maxPerTeam', id: 'maxPerTeam', enabled: false, max: 2 }];

const maxPerTeamRuleSchema = z.object({
  kind: z.literal('maxPerTeam'),
  id: z.literal('maxPerTeam'),
  enabled: z.boolean(),
  max: z.number().int().min(1).max(11),
});

/** Wächst mit `LineupRule` zu einer `z.discriminatedUnion('kind', [...])`, sobald ein zweiter Regeltyp dazukommt. */
export const lineupRuleSchema = maxPerTeamRuleSchema;
export const lineupRulesSchema = z.array(lineupRuleSchema);

/**
 * Aus den aktiven Regeln abgeleitete Schranken — die einzige Schnittstelle
 * zwischen Regel-Vokabular (UI) und Solver (constrainedLineup.ts/lineupOptimizer.ts).
 * Der Solver kennt nur Schranken, nicht die Regeln, die sie erzeugt haben.
 */
export interface LineupConstraints {
  /** Max. Spieler desselben Vereins in der Elf; Infinity = keine Schranke. */
  maxPerTeam: number;
}

export const UNCONSTRAINED_CONSTRAINTS: LineupConstraints = { maxPerTeam: Infinity };

export function toConstraints(rules: readonly LineupRule[]): LineupConstraints {
  const maxPerTeamRule = rules.find((r): r is MaxPerTeamRule => r.kind === 'maxPerTeam' && r.enabled);
  return { maxPerTeam: maxPerTeamRule?.max ?? Infinity };
}

export function isUnconstrained(constraints: LineupConstraints): boolean {
  return constraints.maxPerTeam === Infinity;
}

export function describeRule(rule: LineupRule): string {
  switch (rule.kind) {
    case 'maxPerTeam':
      return `Max. ${rule.max} Spieler pro Verein`;
  }
}

/** Liest gespeicherte Regeln; bei fehlendem/kaputtem Wert die Defaults statt eines Crashs. */
export function parseStoredRules(raw: string | null): LineupRule[] {
  if (!raw) return DEFAULT_RULES;
  try {
    const parsed = lineupRulesSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length > 0 ? parsed.data : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

interface TeamAffiliated {
  id: string;
  teamId: string;
}

/**
 * Aktive Regeln, die eine gegebene Elf (z. B. der manuell bearbeitete Entwurf
 * in lineup.tsx) tatsächlich verletzt — unabhängig vom Optimizer, der Regeln
 * nur bei sich selbst hart durchsetzt, nie bei manuellen Eingriffen (siehe
 * useLineupOptimizer.ts).
 */
export function violatedRules(
  rules: readonly LineupRule[],
  players: readonly TeamAffiliated[],
  lineupIds: readonly string[],
): LineupRule[] {
  const teamById = new Map(players.map((p) => [p.id, p.teamId]));
  const violated: LineupRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.kind === 'maxPerTeam') {
      const counts = new Map<string, number>();
      for (const id of lineupIds) {
        const teamId = teamById.get(id);
        if (!teamId) continue;
        counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
      }
      if ([...counts.values()].some((count) => count > rule.max)) violated.push(rule);
    }
  }
  return violated;
}

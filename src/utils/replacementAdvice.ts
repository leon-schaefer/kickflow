import type { Position } from '@/api/kickbase';
import {
  constrainingRuleIds,
  isUnconstrained,
  UNCONSTRAINED_CONSTRAINTS,
  type LineupConstraints,
} from '@/lineup/rules';
import { deriveBidAdvice, type BidAdvice } from './bidAdvice';
import { availableForRebid, type BudgetLimit } from './budget';
import { optimizeLineupWithRules } from './constrainedLineup';
import { AVAILABLE_FORMATIONS } from './formations';
import { formatValueScore } from './format';
import {
  isAvailableForLineup,
  metricValue,
  type OptimizerMetric,
  type OptimizerPlayer,
} from './lineupOptimizer';
import { median } from './median';

/**
 * Die Kaufseite des Aufstellungs-Optimizers: WELCHEN Spieler vom Markt hole
 * ich, wenn einer meiner eigenen ausfällt — und was ist er mir wert?
 *
 * Das Gegenstück zu utils/sellAdvice.ts, und bewusst nach einem anderen
 * Verfahren. Die Verkaufsseite kann sich auf die Differenz zweier
 * Optimal-Elfen stützen, weil beide Elfen aus demselben Kader kommen. Für
 * einen Zukauf gibt es diesen Vergleich nicht: der Spieler ist noch nicht da.
 * Gemessen wird deshalb direkt, was er ändern WÜRDE —
 *
 *     Zugewinn = beste Elf mit ihm im Kader − beste Elf ohne ihn
 *
 * — eine vollständige Neuoptimierung je Kandidat (`optimizeLineupWithRules`,
 * also inklusive Liga-Regeln wie der Vereins-Obergrenze). Das ist teurer als
 * eine Heuristik und dafür exakt: es berücksichtigt automatisch, dass ein
 * Ersatz nichts bringt, wenn die Bank den Ausfall schon auffängt, und dass ein
 * Formationswechsel einen Zugewinn erst möglich macht. Bei ~25 Kaderspielern
 * und ~30 Listings sind das ~30 Optimierungen — der Grund, warum der Aufrufer
 * das Ergebnis memoisiert (siehe src/lineup/useReplacementAdvice.ts).
 *
 * DIE LIGA-REGELN GELTEN HIER GENAUSO HART wie bei der Aufstellung, und aus
 * demselben Grund: eine Empfehlung, die eine Regel bricht, empfiehlt Punkte,
 * die es nicht gibt. Darf höchstens zwei Spieler eines Vereins aufs Feld, dann
 * bringt ein dritter nur so viel, wie er über den schwächeren der beiden
 * hinaus holt — die Neuoptimierung oben rechnet das automatisch mit, denn sie
 * läuft unter denselben Schranken wie die angezeigte Elf und darf dabei
 * umbauen (siehe den Absatz zum Verdrängen weiter unten). Weil
 * ihn stillschweigend weglassen aber nicht erklärt, WARUM der beste Stürmer
 * der Liga fehlt, wird für jeden so abgelehnten Kandidaten ein zweites Mal
 * OHNE Schranken gerechnet: hätte er ohne die Regel geholfen, steht er als
 * `blockedByRule` mit genau dem Zugewinn da, den die Regel kostet. Damit kann
 * die Anzeige die Wahl benennen, statt sie zu verschweigen — die Regel selbst
 * bleibt unangetastet.
 *
 * EINEN VEREINSKOLLEGEN VERDRÄNGEN DARF ER DABEI JEDERZEIT, ohne dass jemand
 * die Regel dafür lockern müsste. Die Neuoptimierung stellt die ganze Elf neu
 * auf und darf deshalb den dritten Bayern holen, solange einer der beiden
 * anderen den Platz räumt — die Quote bleibt eingehalten, und wenn dieser
 * Umbau Punkte bringt, steht er ganz normal als Empfehlung in `options`. Genau
 * deshalb ist ein Kandidat in `blockedByRule` immer einer, dem der Umbau NICHT
 * hilft: die Kollegen, die weichen müssten, sind besser als er.
 *
 * Für ihn wird der Tausch trotzdem ausgerechnet (`swapGain`, siehe
 * `bestLineupIncluding`) — „geht nicht" ist die eine Antwort, die hier nie
 * stimmt, und was der Umbau kostet, ist die Zahl, nach der die Frage
 * eigentlich verlangt. Das ist die dritte Optimierung je geblocktem Kandidat;
 * sie fällt nur für die wenigen an, die es bis in diese Liste schaffen.
 *
 * DIE METRIK ENTSCHEIDET HIER NUR ÜBER DIE SORTIERUNG, nicht über die
 * Messgröße. Der Zugewinn wird immer in Ø-Punkten (bzw. erwarteten Punkten)
 * gemessen, auch wenn der Optimizer auf Ø-Punkte/Mio steht: die Effizienz
 * eines ZUKAUFS ist Zugewinn je Mio GEBOT, nicht die Quotientensumme über die
 * Elf. Genau diese Unterscheidung steht in lineupOptimizer.ts als Rangfolge
 * der Zielwerte — Punkte sind das Ziel, Effizienz ist das Transfer-Signal.
 * Beides ist hier gleichzeitig sichtbar: `bestGainId` beantwortet „wer ist am
 * besten", `bestEfficiencyId` „wer ist am effizientesten", und beide dürfen
 * verschiedene Spieler nennen.
 */

/**
 * Die Feldmenge, die ein Marktkandidat über `OptimizerPlayer` hinaus braucht
 * — `MarketPlayer` (src/api/kickbase/types.ts) erfüllt sie strukturell.
 */
export interface ReplacementCandidatePlayer extends OptimizerPlayer {
  /** Angebotspreis des Verkäufers, nicht der Marktwert. */
  price: number;
  isBotListing: boolean;
  offerCount: number;
  expiresInSeconds: number | null;
  /** Mein eigenes Gebot auf dieses Listing, `null` ohne — siehe `BidAdviceInput.ownOfferPrice`. */
  ownOfferPrice: number | null;
}

/** Ein Ausfall im eigenen Kader — der Anlass, überhaupt nachzukaufen. */
export interface SquadGap {
  playerId: string;
  position: Position;
  /**
   * Was die Optimalelf durch den Ausfall verliert. 0 heißt: er würde ohnehin
   * nicht starten, die Bank fängt ihn auf — kein Grund für einen Zukauf.
   */
  loss: number;
  /**
   * true, wenn die Elf ohne ihn überhaupt nicht mehr besetzbar ist. Dann ist
   * `loss` keine Differenz mehr (es gibt keine Elf, von der man abziehen
   * könnte), sondern 0 — die Dringlichkeit steckt in diesem Flag.
   */
  breaksLineup: boolean;
}

export interface ReplacementOption {
  playerId: string;
  /**
   * Zugewinn der Optimalelf in Ø-Punkten. Bei nicht besetzbarer Ausgangself
   * (`ReplacementAdvice.baselineFeasible === false`) ist es stattdessen der
   * Punktwert der Elf, die er erst möglich macht — vergleichbar innerhalb der
   * Liste, aber keine Differenz.
   */
  gain: number;
  /** Zugewinn je Mio des Preises, den der Zukauf kostet — die Effizienz des Transfers. */
  gainPerMillion: number;
  /** Woran `gainPerMillion` gerechnet ist: das empfohlene Gebot, sonst die Wettbewerbs-Untergrenze. */
  cost: number;
  bid: BidAdvice;
  /** Die Formation der Elf MIT ihm — kann von der bisherigen abweichen. */
  formation: string | null;
  /** Wer durch ihn aus der Elf fällt. Leer, wenn er eine unbesetzte Position füllt. */
  replacesPlayerIds: string[];
  /**
   * Ausfälle, deren Position er abdeckt — der direkte Ersatz. Nur Ausfälle,
   * die die Elf wirklich schwächen; ein verletzter Bankspieler zählt nicht.
   */
  coversGapPlayerIds: string[];
  /** true, wenn die Elf erst mit ihm überhaupt besetzbar ist. */
  enablesLineup: boolean;
}

/**
 * Ein Marktspieler, der die Elf verbessern WÜRDE, den eine aktive Liga-Regel
 * aber nicht aufs Feld lässt (siehe src/lineup/rules.ts).
 *
 * Er ist kein Vorschlag — die Regel ist hart, und ein Spieler, der nicht
 * spielen darf, bringt keine Punkte. Er wird trotzdem benannt, weil die
 * Alternative Schweigen wäre: der beste Stürmer der Liga steht am Markt, die
 * Kaufliste erwähnt ihn nicht, und niemand kann sehen warum. Genau dieselbe
 * Diagnose macht die OptimizerBar für blockierte Formationen
 * (`FormationResult.blockedByRuleIds`).
 */
export interface RuleBlockedCandidate {
  playerId: string;
  /** Zugewinn, den er OHNE die Regel gebracht hätte — was die Regel hier kostet. */
  gainWithoutRule: number;
  /** IDs der Regeln, die dafür verantwortlich sind (siehe `constrainingRuleIds`). */
  blockedByRuleIds: string[];
  /**
   * Was die Elf gewinnt, wenn er REGELKONFORM trotzdem aufgestellt wird — ein
   * Vereinskollege weicht also für ihn. Nie positiv: wäre der Tausch ein
   * Gewinn, hätte die Neuoptimierung ihn von selbst gemacht und der Kandidat
   * stünde in `options`. `null`, wenn es unter der Regel überhaupt keine Elf
   * mit ihm gibt (dann steht kein Tausch zur Wahl).
   */
  swapGain: number | null;
  /** Wer dafür aus der bisherigen Elf fällt — darunter der Vereinskollege. */
  swapOutPlayerIds: string[];
}

export interface ReplacementAdvice {
  gaps: SquadGap[];
  /** Summe der Verluste aller Ausfälle — die Punkte, um die es beim Nachkaufen geht. */
  totalLoss: number;
  /** Kandidaten mit echtem Zugewinn, sortiert nach der aktiven Metrik (siehe Modul-Doku). */
  options: ReplacementOption[];
  /**
   * Kandidaten, die nur eine aktive Liga-Regel aus der Elf hält, absteigend
   * nach dem Zugewinn, den sie ohne die Regel gebracht hätten. Immer leer,
   * solange keine Regel aktiv ist.
   */
  blockedByRule: RuleBlockedCandidate[];
  /** Größter absoluter Zugewinn — „am besten". */
  bestGainId: string | null;
  /** Größter Zugewinn je Mio — „am effizientesten". */
  bestEfficiencyId: string | null;
  /** Punktwert der Elf ohne Zukauf, Bezugsgröße jedes `gain`. `null` = nicht besetzbar. */
  baselineScore: number | null;
  baselineFeasible: boolean;
  /** Ø-Punkte/Mio, die der eigene Kader im Median liefert — Basis jeder Wertobergrenze. */
  referenceValueScore: number;
  /** Wie viele Listings überhaupt geprüft wurden (nach Abzug eigener und ausgefallener). */
  consideredCount: number;
}

/**
 * Was der Zukauf mit der Elf macht, in einem Satz — die sportliche Hälfte der
 * Begründung, neben der preislichen aus `BidAdvice.reason`.
 *
 * Hier und nicht in der Komponente, aus demselben Grund wie `SellAdvice.reason`:
 * die Fallunterscheidung ist Logik (füllt eine Lücke / ersetzt einen Ausfall /
 * verdrängt einen Gesunden) und gehört in ein testbares Modul. `nameById`
 * liefert Anzeigenamen; für eine unbekannte ID fällt der Satz auf die
 * allgemeine Formulierung zurück, statt eine ID anzuzeigen.
 */
export function describeReplacement(
  option: ReplacementOption,
  nameById: (id: string) => string | undefined,
): string {
  const names = (ids: readonly string[]) =>
    ids.map(nameById).filter((name): name is string => !!name);

  if (option.enablesLineup) {
    return 'Macht die Elf überhaupt erst besetzbar.';
  }
  const covered = names(option.coversGapPlayerIds);
  if (covered.length > 0) {
    return `Direkter Ersatz für ${covered.join(', ')} — dieselbe Position.`;
  }
  const replaced = names(option.replacesPlayerIds);
  if (replaced.length === 1) {
    return `Kommt für ${replaced[0]} in die Elf.`;
  }
  if (replaced.length > 1) {
    return `Verändert die Elf an ${replaced.length} Stellen (${replaced.join(', ')}).`;
  }
  return 'Hebt die Elf an, ohne einen Ausfall zu ersetzen.';
}

/**
 * „Und wenn dafür ein Vereinskollege weicht?" in einem Satz — die
 * Gegenrechnung zur Regel-Blockade, Gegenstück zu `describeReplacement`.
 *
 * Hier und nicht in der Komponente, aus demselben Grund wie dort: WER weicht
 * und ob der Tausch etwas kostet, ist Logik. `null`, wenn der Tausch gar nicht
 * existiert — dann gibt es nichts zu erklären, und die Anzeige lässt die Zeile
 * weg, statt einen leeren Satz zu bauen.
 */
export function describeRuleSwap(
  entry: RuleBlockedCandidate,
  nameById: (id: string) => string | undefined,
): string | null {
  if (entry.swapGain === null) return null;
  const leaving = entry.swapOutPlayerIds
    .map(nameById)
    .filter((name): name is string => !!name);
  // Unbekannte ID → die allgemeine Formulierung, nie eine ID anzeigen.
  const who = leaving.length > 0 ? leaving.join(', ') : 'ein Vereinskollege';
  // Ein Umbau quer über die Positionen kann mehrere Plätze berühren.
  const verb = leaving.length > 1 ? 'weichen' : 'weicht';
  return entry.swapGain < 0
    ? `Aufstellbar wäre er, wenn ${who} ${verb} — das kostet ${formatValueScore(-entry.swapGain)} Ø-Punkte.`
    : `Aufstellbar wäre er, wenn ${who} ${verb} — das ändert an den Ø-Punkten nichts.`;
}

export interface ReplacementAdviceInput {
  players: readonly OptimizerPlayer[];
  /** Der Transfermarkt der Liga. Eigene (schon gelistete) Spieler dürfen drin bleiben, sie fallen hier heraus. */
  market: readonly ReplacementCandidatePlayer[];
  /** Die aktive Optimizer-Metrik — bestimmt Messgröße (Punkte vs. erwartete Punkte) und Sortierung. */
  metric: OptimizerMetric;
  formations?: readonly string[];
  constraints?: LineupConstraints;
  /**
   * Der 33%-Rahmen (utils/budget.ts), `null` = unbekannt, dann wird kein Gebot
   * gedeckelt. Das ganze Limit und nicht nur `available`: für einen Spieler,
   * auf den ich schon geboten habe, ist der Spielraum ein anderer — das alte
   * Gebot wird ersetzt und sein Betrag ist wieder frei (`availableForRebid`).
   */
  budget?: BudgetLimit | null;
}

/**
 * Ø-Punkte oder erwartete Punkte — nie Ø-Punkte/Mio. Siehe Modul-Doku: die
 * Effizienz eines Zukaufs entsteht erst durch die Division mit dem Preis.
 */
function scoreMetricFor(metric: OptimizerMetric): OptimizerMetric {
  return metric === 'expectedPoints' ? 'expectedPoints' : 'points';
}

function compareByGain(a: ReplacementOption, b: ReplacementOption): number {
  return (
    b.gain - a.gain ||
    b.gainPerMillion - a.gainPerMillion ||
    a.playerId.localeCompare(b.playerId)
  );
}

function compareByEfficiency(a: ReplacementOption, b: ReplacementOption): number {
  return (
    b.gainPerMillion - a.gainPerMillion ||
    b.gain - a.gain ||
    a.playerId.localeCompare(b.playerId)
  );
}

/**
 * Effizienz-Maßstab des eigenen Kaders: der Median der Ø-Punkte/Mio über die
 * Spieler, die tatsächlich spielen (die Optimalelf). Bewusst nicht über den
 * ganzen Kader — Bankspieler drücken den Median und würden jeden Zukauf zu
 * teuer erscheinen lassen. Ist keine Elf besetzbar, bleiben alle
 * einsatzfähigen Spieler als Rückfall.
 */
function squadEfficiency(players: readonly OptimizerPlayer[], bestXiIds: readonly string[]): number {
  const inXi = new Set(bestXiIds);
  const relevant = bestXiIds.length > 0
    ? players.filter((p) => inXi.has(p.id))
    : players.filter((p) => isAvailableForLineup(p.status));
  return median(relevant.map((p) => p.valueScoreAvg));
}

/**
 * Ein Bonus, der größer ist als jede erreichbare Elf-Summe: die Summe der
 * Beträge aller Spielerwerte plus eins. Damit schlägt JEDE Elf mit dem
 * Bonus-Spieler jede Elf ohne ihn, egal wie die restlichen zehn Plätze
 * ausfallen (siehe `bestLineupIncluding`).
 */
function forcingBonus(players: readonly OptimizerPlayer[], metric: OptimizerMetric): number {
  return players.reduce((sum, player) => sum + Math.abs(metricValue(player, metric)), 1);
}

/**
 * Die beste regelkonforme Elf, die diesen Kandidaten ERZWUNGEN enthält — die
 * Antwort auf „und wenn dafür ein Vereinskollege weicht?".
 *
 * Der Optimizer maximiert und lässt einen Spieler, der die Elf nicht anhebt,
 * folgerichtig draußen. Um trotzdem zu erfahren, was seine Aufstellung KOSTEN
 * würde, bekommt er hier `forcingBonus` aufgeschlagen; danach wird derselbe
 * Betrag vom Ergebnis wieder abgezogen. Die Auswahl der übrigen zehn Plätze
 * bleibt davon unberührt — ein konstanter Summand verschiebt keine Rangfolge
 * zwischen zwei Elfen, die ihn beide enthalten.
 *
 * DIE SCHRANKEN BLEIBEN DABEI HART: der Verein stellt weiter höchstens
 * `maxPerTeam` Spieler, nur ist einer davon zwangsweise er. Das Ergebnis ist
 * also ein regelkonformer Tausch, kein Regelbruch.
 *
 * `null`, wenn auch mit Bonus keine Elf mit ihm besetzbar ist — dann hält ihn
 * nicht die Auswahl draußen, sondern die Kombinatorik (etwa: seine beiden
 * Vereinskollegen sind auf ihren Positionen alternativlos).
 */
function bestLineupIncluding(
  players: readonly OptimizerPlayer[],
  candidate: OptimizerPlayer,
  metric: OptimizerMetric,
  formations: readonly string[],
  constraints: LineupConstraints,
): { score: number; playerIds: string[] } | null {
  const bonus = forcingBonus([...players, candidate], metric);
  const forced: OptimizerPlayer = {
    ...candidate,
    averagePoints: candidate.averagePoints + bonus,
    expectedPoints: (candidate.expectedPoints ?? candidate.averagePoints) + bonus,
  };
  const best = optimizeLineupWithRules([...players, forced], metric, formations, constraints).best;
  // `score` ist bei einer besetzbaren Elf immer gesetzt; die Prüfung hält den
  // Typvertrag ein, statt ihn mit `!` zu überstimmen.
  if (!best || best.score === null || !best.playerIds.includes(candidate.id)) return null;
  return { score: best.score - bonus, playerIds: best.playerIds };
}

export function deriveReplacementAdvice({
  players,
  market,
  metric,
  formations = AVAILABLE_FORMATIONS,
  constraints = UNCONSTRAINED_CONSTRAINTS,
  budget = null,
}: ReplacementAdviceInput): ReplacementAdvice {
  const scoreMetric = scoreMetricFor(metric);
  const baseline = optimizeLineupWithRules(players, scoreMetric, formations, constraints);
  const baselineScore = baseline.best?.score ?? null;
  const baselineFeasible = baseline.best !== null;
  const baselineIds = baseline.best?.playerIds ?? [];
  const referenceValueScore = squadEfficiency(players, baselineIds);

  // Ein Ausfall ist so teuer, wie die Elf MIT ihm besser wäre. Das ist keine
  // Schätzung, sondern dieselbe Optimierung ein zweites Mal — nur mit `fit`
  // statt seines echten Status. Kostet eine Optimierung je Ausfall; in einem
  // echten Kader sind das null bis drei.
  const gaps: SquadGap[] = players
    .filter((player) => !isAvailableForLineup(player.status))
    .map((player) => {
      const asFit = players.map((p) => (p.id === player.id ? { ...p, status: 'fit' as const } : p));
      const withHim = optimizeLineupWithRules(asFit, scoreMetric, formations, constraints);
      const withScore = withHim.best?.score ?? null;
      return {
        playerId: player.id,
        position: player.position,
        loss:
          baselineScore !== null && withScore !== null ? Math.max(0, withScore - baselineScore) : 0,
        breaksLineup: !baselineFeasible && withScore !== null,
      };
    });

  // Nur Ausfälle, die WEHTUN, machen einen Kandidaten zum „direkten Ersatz".
  // Ein verletzter Bankspieler teilt zwar die Position, aber ihn zu ersetzen
  // ist keine Aufgabe — die Elf hat ihn nie gebraucht. Alle Ausfälle bleiben
  // in `gaps` sichtbar, samt ihrer Folgenlosigkeit.
  const gapPositions = new Map<Position, string[]>();
  for (const gap of gaps) {
    if (gap.loss <= 0 && !gap.breaksLineup) continue;
    const list = gapPositions.get(gap.position);
    if (list) list.push(gap.playerId);
    else gapPositions.set(gap.position, [gap.playerId]);
  }

  const squadIds = new Set(players.map((p) => p.id));
  // Eigene Listings (die tauchen im Markt mit auf) und ausgefallene Kandidaten
  // fallen heraus: der eine ist schon da, der andere hilft am Spieltag nicht.
  // Ein verletzter Kandidat käme über `optimizeLineupWithRules` ohnehin mit
  // Zugewinn 0 heraus — ihn hier zu überspringen spart nur die Optimierung.
  const candidates = market.filter(
    (player) => !squadIds.has(player.id) && isAvailableForLineup(player.status),
  );

  // Zweite Bezugsgröße, NUR wenn eine Regel aktiv ist: dieselbe Rechnung ohne
  // Schranken. Sie beantwortet für einen abgelehnten Kandidaten die Frage
  // "hätte er ohne die Regel geholfen?" exakt, statt sie zu schätzen — und sie
  // ist der billige Pfad: ohne Schranken delegiert optimizeLineupWithRules an
  // das reine Sortier-Verfahren in lineupOptimizer.ts, nicht an die DP.
  const ruleIds = constrainingRuleIds(constraints);
  const rulesActive = !isUnconstrained(constraints);
  const openBaselineScore = rulesActive
    ? (optimizeLineupWithRules(players, scoreMetric, formations, UNCONSTRAINED_CONSTRAINTS).best
        ?.score ?? null)
    : baselineScore;

  const options: ReplacementOption[] = [];
  const blockedByRule: RuleBlockedCandidate[] = [];
  for (const candidate of candidates) {
    const withCandidate = optimizeLineupWithRules(
      [...players, candidate],
      scoreMetric,
      formations,
      constraints,
    );
    const withScore = withCandidate.best?.score ?? null;
    if (withScore === null) continue;
    const gain = baselineScore === null ? withScore : withScore - baselineScore;
    // Nur echte Verbesserungen. Ein Kandidat, der die Elf nicht anhebt, ist
    // keine Kaufempfehlung — er wäre nur eine teurere Bank.
    if (gain <= 0) {
      if (!rulesActive) continue;
      // Läge er ohne die Regel vorn, ist nicht er das Problem, sondern sie.
      const withoutRule = optimizeLineupWithRules(
        [...players, candidate],
        scoreMetric,
        formations,
        UNCONSTRAINED_CONSTRAINTS,
      );
      const openScore = withoutRule.best?.score ?? null;
      if (openScore === null) continue;
      const openGain = openBaselineScore === null ? openScore : openScore - openBaselineScore;
      if (openGain > 0) {
        // Was der regelkonforme Umbau kostet — die Frage, die ein „von der
        // Regel geblockt" unbeantwortet lässt.
        const swap = bestLineupIncluding(players, candidate, scoreMetric, formations, constraints);
        const swapIds = swap ? new Set(swap.playerIds) : null;
        blockedByRule.push({
          playerId: candidate.id,
          gainWithoutRule: openGain,
          blockedByRuleIds: ruleIds,
          swapGain:
            swap === null ? null : baselineScore === null ? swap.score : swap.score - baselineScore,
          swapOutPlayerIds: swapIds ? baselineIds.filter((id) => !swapIds.has(id)) : [],
        });
      }
      continue;
    }

    const bid = deriveBidAdvice({
      price: candidate.price,
      marketValue: candidate.marketValue,
      offerCount: candidate.offerCount,
      ownOfferPrice: candidate.ownOfferPrice,
      isBotListing: candidate.isBotListing,
      expiresInSeconds: candidate.expiresInSeconds,
      averagePoints: candidate.averagePoints,
      referenceValueScore,
      available: budget === null ? null : availableForRebid(budget, candidate.ownOfferPrice),
    });
    // Am Budget gedeckelte Gebote dürfen die Effizienz nicht schönrechnen —
    // deshalb die Wettbewerbs-Untergrenze als Rückfall und nicht das gekürzte
    // Gebot. `competitiveBid` ist immer ≥ Angebotspreis, also nie zu billig.
    const cost = bid.verdict === 'kein-budget' || bid.cappedByBudget ? bid.competitiveBid : bid.bid!;

    const withIds = new Set(withCandidate.best!.playerIds);
    options.push({
      playerId: candidate.id,
      gain,
      gainPerMillion: cost > 0 ? gain / (cost / 1_000_000) : 0,
      cost,
      bid,
      formation: withCandidate.best!.formation,
      replacesPlayerIds: baselineIds.filter((id) => !withIds.has(id)),
      coversGapPlayerIds: gapPositions.get(candidate.position) ?? [],
      enablesLineup: !baselineFeasible,
    });
  }

  const bestGainId = options.length > 0 ? [...options].sort(compareByGain)[0]!.playerId : null;
  const bestEfficiencyId =
    options.length > 0 ? [...options].sort(compareByEfficiency)[0]!.playerId : null;

  return {
    gaps,
    totalLoss: gaps.reduce((sum, gap) => sum + gap.loss, 0),
    options: options.sort(metric === 'valuePerMillion' ? compareByEfficiency : compareByGain),
    blockedByRule: blockedByRule.sort(
      (a, b) => b.gainWithoutRule - a.gainWithoutRule || a.playerId.localeCompare(b.playerId),
    ),
    bestGainId,
    bestEfficiencyId,
    baselineScore,
    baselineFeasible,
    referenceValueScore,
    consideredCount: candidates.length,
  };
}

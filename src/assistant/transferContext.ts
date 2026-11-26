import type { MarketPlayer, SquadPlayer } from '@/api/kickbase';
import type { LineupConstraints } from '@/lineup/rules';
import type { BudgetLimit } from '@/utils/budget';
import { withExpectedPoints, type AverageDifficulty } from '@/utils/fixtureDifficulty';
import type { OptimizerMetric } from '@/utils/lineupOptimizer';
import type { ReplacementAdvice } from '@/utils/replacementAdvice';
import type { SellAdvice } from '@/utils/sellAdvice';
import type { SellPlan } from '@/utils/sellPlan';

interface TransferContextInput {
  squad: readonly SquadPlayer[];
  market: readonly MarketPlayer[] | null;
  lineup: readonly SquadPlayer[];
  formation: string;
  matchday: number | null;
  deadlineMinutes: number | null;
  balance: number | null;
  budget: BudgetLimit | null;
  constraints: LineupConstraints;
  metric: OptimizerMetric;
  difficulty?: ReadonlyMap<string, AverageDifficulty>;
  buy: ReplacementAdvice;
  sell: readonly SellAdvice[];
  sellPlan: SellPlan | null;
}

function playerFacts(player: (SquadPlayer | MarketPlayer) & { expectedPoints?: number }) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    teamId: player.teamId,
    status: player.status,
    marketValue: player.marketValue,
    marketValueTrend: player.marketValueTrend,
    averagePoints: player.averagePointsKnown === false ? null : player.averagePoints,
    formAveragePoints: player.formAveragePoints,
    expectedPoints: player.averagePointsKnown === false ? null : player.expectedPoints,
  };
}

export function transferContext(input: TransferContextInput) {
  const starters = new Set(input.lineup.map((player) => player.id));
  const sellById = new Map(input.sell.map((advice) => [advice.playerId, advice]));
  const buyById = new Map(input.buy.options.map((advice) => [advice.playerId, advice]));
  return {
    matchday: input.matchday,
    deadlineMinutes: input.deadlineMinutes,
    formation: input.formation,
    balance: input.balance,
    budgetLimit: input.budget,
    metric: input.metric,
    maxStartersPerClub: Number.isFinite(input.constraints.maxPerTeam) ? input.constraints.maxPerTeam : null,
    squad: withExpectedPoints(input.squad, input.difficulty).map((player) => ({
      ...playerFacts(player),
      inLineup: starters.has(player.id),
      marketValueChangeToday: player.marketValueChangeToday,
      sellAdvice: sellById.get(player.id),
    })),
    market: input.market === null ? null : withExpectedPoints(input.market, input.difficulty).map((player) => ({
      ...playerFacts(player),
      askingPrice: player.price,
      ownOfferPrice: player.ownOfferPrice,
      offerCount: player.offerCount,
      isKickbaseListing: player.isBotListing,
      expiresInSeconds: player.expiresInSeconds,
      buyAdvice: buyById.get(player.id),
    })),
    squadGaps: input.buy.gaps,
    blockedByRule: input.buy.blockedByRule,
    sellPlan: input.sellPlan && {
      sales: input.sellPlan.sell,
      estimatedProceeds: input.sellPlan.proceeds,
      balanceAfter: input.sellPlan.balanceAfter,
      shortfall: input.sellPlan.shortfall,
    },
  };
}

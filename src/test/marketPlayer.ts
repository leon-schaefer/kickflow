import type { MarketPlayer } from '@/api/kickbase';
import { pointsPerMillion } from '@/utils/valueScore';

/**
 * Marktspieler-Attrappe für DOM-Tests — Gegenstück zu `squadPlayer.ts`.
 *
 * Die beiden Punkte/Mio-Kennzahlen werden wie im echten Mapper
 * (src/api/kickbase/mappers.ts) aus Marktwert und Punkten ABGELEITET und nicht
 * mitgegeben: die Kaufempfehlung (src/utils/replacementAdvice.ts) rechnet mit
 * beiden Größen gleichzeitig, und ein Kandidat mit 200 Ø-Punkten und einem
 * hartkodierten valueScoreAvg von 12 wäre ein Spieler, den es nicht geben
 * kann. Wer die Kennzahl gezielt entkoppeln will, überschreibt sie weiterhin.
 */
export function marketPlayer(overrides: Partial<MarketPlayer> = {}): MarketPlayer {
  const marketValue = overrides.marketValue ?? 10_000_000;
  const averagePoints = overrides.averagePoints ?? 120;
  const totalPoints = overrides.totalPoints ?? averagePoints;
  return {
    id: 'm1',
    name: 'Nico Bauer',
    position: 'MID',
    teamId: '90',
    marketValue,
    marketValueTrend: 'up',
    totalPoints,
    averagePoints,
    valueScoreAvg: pointsPerMillion(averagePoints, marketValue),
    valueScoreTotal: pointsPerMillion(totalPoints, marketValue),
    status: 'fit',
    imageUrl: null,
    price: marketValue,
    isBotListing: true,
    sellerName: null,
    sellerId: null,
    offerCount: 0,
    listedAt: null,
    expiresInSeconds: null,
    ownOfferPrice: null,
    ownOfferId: null,
    offers: [],
    ...overrides,
  };
}

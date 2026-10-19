import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toMatchdaySchedule, toSeasonPerformances } from '@/api/kickbase/mappers';
import { lineupData } from '@/test/lineupData';
import { squadPlayer } from '@/test/squadPlayer';
import { marketPlayer } from '@/test/marketPlayer';
import { playerDetail } from '@/test/playerDetail';
import type { SeasonPerformance } from '@/api/kickbase/types';
import { useLineup, useMarket, usePlayer } from './hooks';
import { queryKeys } from './keys';

const api = vi.hoisted(() => ({
  getLineup: vi.fn(), getMarket: vi.fn(), getMatchdays: vi.fn(), getPlayerPerformance: vi.fn(), getPlayer: vi.fn(),
}));
vi.mock('@/api/kickbase', async (original) => ({ ...await original<object>(), ...api }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('@/leagues/useCompetitionId', () => ({ useCompetitionId: () => '1' }));

const rows = [150, 150, 0, 0, 0].map((p, index) => ({
  day: index + 1, md: `2026-09-0${index + 1}T15:30:00Z`,
  t1: 'a', t2: 'b', pt: 'a', t1g: 0, t2g: 0, p, mp: p ? "90'" : "0'",
}));
const performance = toSeasonPerformances({ it: [{ ti: '2026/27', ph: rows }] });
const schedule = toMatchdaySchedule({ it: rows.map((r) => ({ day: r.day, it: [{ ...r, dt: r.md }] })) });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getLineup.mockResolvedValue(lineupData([
    squadPlayer({ id: '1', averagePoints: 150, averagePointsBasis: 'kickbase', marketValue: 10_000_000 }),
    squadPlayer({ id: '2', averagePoints: 150, averagePointsBasis: 'kickbase', marketValue: 10_000_000 }),
  ]));
  api.getMarket.mockResolvedValue({ players: [marketPlayer({ id: '1', averagePoints: 150, averagePointsBasis: 'kickbase' })] });
  api.getMatchdays.mockResolvedValue(schedule);
  api.getPlayerPerformance.mockResolvedValue(performance);
  api.getPlayer.mockImplementation(async (_token, _league, _id, load) => playerDetail({
    averagePointsBasis: 'kickbase', performance: await load(),
  }));
});

afterEach(() => { vi.useRealTimers(); });

describe('gemeinsame Schnitt-Historien', () => {
  it('wechselt den ganzen Kader gemeinsam und teilt Historien mit Markt und Profil', async () => {
    let complete!: (value: SeasonPerformance[]) => void;
    const delayed = new Promise<SeasonPerformance[]>((resolve) => { complete = resolve; });
    api.getPlayerPerformance.mockImplementation((_token, _league, id) => id === '2' ? delayed : Promise.resolve(performance));
    const { client, wrapper } = setup();
    const hook = renderHook(({ profile }) => ({
      lineup: useLineup('42'), market: useMarket('42'), player: usePlayer('42', profile ? '1' : ''),
    }), { wrapper, initialProps: { profile: false } });
    await waitFor(() => expect(hook.result.current.market.data?.players[0]?.averagePoints).toBe(60));
    await waitFor(() => expect(hook.result.current.lineup.data).toBeDefined());
    expect(hook.result.current.lineup.data?.players.map((p) => p.averagePoints)).toEqual([150, 150]);
    expect(hook.result.current.lineup.pointAverageState.basis).toBe('kickbase');
    await act(async () => { complete(performance); });
    await waitFor(() => expect(hook.result.current.lineup.pointAverageState.basis).toBe('matchdays'));
    expect(hook.result.current.lineup.data?.players.map((p) => p.averagePoints)).toEqual([60, 60]);
    expect(hook.result.current.lineup.data?.players[0]?.valueScoreAvg).toBe(6);
    expect(hook.result.current.lineup.rawData?.players[0]?.averagePoints).toBe(150);
    hook.rerender({ profile: true });
    await waitFor(() => expect(hook.result.current.player.data?.appearanceAveragePoints).toBe(150));
    expect(api.getPlayerPerformance).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('behält bei einem Fehler für den ganzen Pool den gekennzeichneten Rohwert', async () => {
    api.getPlayerPerformance.mockImplementation((_token, _league, id) => id === '2'
      ? Promise.reject(new Error('offline')) : Promise.resolve(performance));
    const { client, wrapper } = setup();
    const hook = renderHook(() => useLineup('42'), { wrapper });
    await waitFor(() => expect(api.getPlayerPerformance).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.pointAverageState.pending).toBe(0));
    expect(hook.result.current.data?.players.map((p) => p.averagePointsBasis)).toEqual(['kickbase', 'kickbase']);
    expect(hook.result.current.data?.players.map((p) => p.averagePoints)).toEqual([150, 150]);
    client.clear();
  });

  it('aktualisiert beim Pull auch die geteilten Historien', async () => {
    const { client, wrapper } = setup();
    const hook = renderHook(() => useLineup('42'), { wrapper });
    await waitFor(() => expect(hook.result.current.data?.players[0]?.averagePoints).toBe(60));
    api.getPlayerPerformance.mockResolvedValue(toSeasonPerformances({ it: [{ ph: rows.map((r) => ({ ...r, p: 0, mp: "0'" })) }] }));
    await act(async () => { await hook.result.current.refetch(); });
    await waitFor(() => expect(hook.result.current.data?.players[0]?.averagePoints).toBe(0));
    client.clear();
  });
  it('wertet die Zeitgrenze nach identischem Refresh in Kader und Profil neu aus', async () => {
    // Nur Date stellen: Query-/waitFor-Timer laufen weiter normal.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T17:30:00Z'));
    const { client, wrapper } = setup();
    const hook = renderHook(() => ({ lineup: useLineup('42'), player: usePlayer('42', '1') }), { wrapper });
    await waitFor(() => expect(hook.result.current.lineup.data?.players[0]?.averagePointsBasis).toBe('matchdays'));
    await waitFor(() => expect(hook.result.current.player.data?.averagePointsBasis).toBe('matchdays'));
    expect(hook.result.current.lineup.data?.players[0]?.averagePoints).toBe(0);
    expect(hook.result.current.player.data?.averagePoints).toBe(0);
    const cached = client.getQueryData(queryKeys.playerPerformance('42', '1'));
    vi.setSystemTime(new Date('2026-09-01T19:30:00Z'));
    await act(async () => { await hook.result.current.lineup.refetch(); });
    await waitFor(() => expect(hook.result.current.lineup.data?.players[0]?.averagePoints).toBe(150));
    await act(async () => { await hook.result.current.player.refetch(); });
    await waitFor(() => expect(hook.result.current.player.data?.averagePoints).toBe(150));
    expect(client.getQueryData(queryKeys.playerPerformance('42', '1'))).toBe(cached);
    client.clear();
  });

});

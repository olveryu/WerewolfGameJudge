/** Games tab: game switching, stats display, and supply triggers. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameWordGame, GameWordsStats } from '@/features/admin/model/adminContracts';
import { fetchGameWordsStats, triggerGameWordSupply } from '@/features/admin/services/adminApi';
import { showAlert } from '@/utils/alert';

import { GamesTab } from '../GamesTab';

vi.mock('@/features/admin/services/adminApi', () => ({
  fetchGameWordsStats: vi.fn(),
  triggerGameWordSupply: vi.fn(),
}));

vi.mock('@/utils/alert', () => ({
  showAlert: vi.fn(),
  CANCEL_BUTTON: { text: '取消', style: 'cancel' },
}));

const fetchStatsMock = vi.mocked(fetchGameWordsStats);
const triggerSupplyMock = vi.mocked(triggerGameWordSupply);
const showAlertMock = vi.mocked(showAlert);

const FIBKING_STATS: GameWordsStats = {
  game: 'fibking',
  wordsByCategory: [{ category: 'literary', active: 10, total: 12 }],
  monthlySupply: {
    month: '2026-09',
    reserved: 30,
    published: 25,
    batchLimit: 60,
    wordTarget: 500,
  },
  tavilyRequestsUsed: 128,
  tavilyMonthlyQuota: 1000,
  reviewDecisions: [
    { decision: 'accepted', count: 8 },
    { decision: 'rejected', count: 2 },
  ],
  reviewCheckStats: [
    { check: 'isEstablishedTerm', failCount: 0 },
    { check: 'isDefinitionAccurate', failCount: 1 },
    { check: 'isMeaningUnfamiliarToMostPlayers', failCount: 1 },
    { check: 'isMeaningDistinctFromLiteralReading', failCount: 0 },
    { check: 'hasMultiplePlausibleWrongDefinitions', failCount: 2 },
    { check: 'hasRevealValue', failCount: 2 },
  ],
  queryLeaderboard: [{ label: '跳舞草', detail: '植物', publishedWords: 5, packs: 2 }],
  supplyEnabled: true,
};

const UNDERCOVER_STATS: GameWordsStats = {
  game: 'undercover',
  wordsByCategory: [{ category: 'daily', active: 20, total: 20 }],
  monthlySupply: null,
  tavilyRequestsUsed: null,
  tavilyMonthlyQuota: null,
  reviewDecisions: [],
  reviewCheckStats: [],
  queryLeaderboard: [{ label: 'daily', detail: null, publishedWords: 20, packs: 4 }],
  supplyEnabled: true,
};

const DRAWGUESS_STATS: GameWordsStats = {
  game: 'drawguess',
  wordsByCategory: [{ category: 'animals', active: 7, total: 9 }],
  monthlySupply: null,
  tavilyRequestsUsed: null,
  tavilyMonthlyQuota: null,
  reviewDecisions: [
    { decision: 'accepted', count: 6 },
    { decision: 'rejected', count: 2 },
  ],
  reviewCheckStats: [],
  queryLeaderboard: [{ label: 'animals', detail: 'active 题目', publishedWords: 7, packs: 3 }],
  supplyEnabled: true,
};

function renderGamesTab() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GamesTab />
    </QueryClientProvider>,
  );
}

/** The confirmation alert's title and message. */
function alertText(): { title: string; message: string | undefined } {
  const call = showAlertMock.mock.calls[0];
  if (call === undefined) throw new Error('showAlert was not called');
  return { title: call[0], message: call[1] };
}

/** Presses the confirmation alert's 确定 button. */
function pressAlertConfirm() {
  const confirm = showAlertMock.mock.calls[0]?.[2]?.find((button) => button.text === '确定');
  if (confirm?.onPress === undefined) throw new Error('No 确定 button in the alert');
  void confirm.onPress();
}

function manyLeaderboardRows() {
  return Array.from({ length: 16 }, (_, index) => ({
    label: `查询${index + 1}`,
    detail: null,
    publishedWords: 16 - index,
    packs: 1,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchStatsMock.mockImplementation(async (game: GameWordGame) =>
    game === 'undercover' ? UNDERCOVER_STATS : FIBKING_STATS,
  );
  triggerSupplyMock.mockResolvedValue({ game: 'fibking', force: false, workflowId: 'x' });
});

describe('GamesTab', () => {
  it('loads fibking stats by default', async () => {
    renderGamesTab();
    expect(await screen.findByText('在库词数')).toBeDefined();
    expect(fetchStatsMock).toHaveBeenCalledWith('fibking');
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByText('25/500')).toBeDefined();
    expect(screen.getByText('80%')).toBeDefined();
    expect(screen.getByText('本月剩余 30 次（配额 60） · Tavily 本月已用 128/1000')).toBeDefined();
    expect(screen.getByText('5/2批')).toBeDefined();
  });

  it('shows the review rejection breakdown for fibking', async () => {
    renderGamesTab();
    expect(await screen.findByText('审核拒因分布（近 30 天）')).toBeDefined();
    expect(screen.getByText('释义准确 不通过')).toBeDefined();
    expect(screen.getByText('真义陌生 不通过')).toBeDefined();
  });

  it('switches to undercover and shows its stats without a monthly budget', async () => {
    renderGamesTab();
    await screen.findByText('在库词数');
    fireEvent.click(screen.getByRole('button', { name: '谁是卧底' }));
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledWith('undercover'));
    expect(await screen.findByText('无月配额')).toBeDefined();
    expect(screen.getByText('「谁是卧底」无月配额限制')).toBeDefined();
  });

  it('switches to drawguess and localizes its categories', async () => {
    fetchStatsMock.mockImplementation(async (game: GameWordGame) =>
      game === 'drawguess' ? DRAWGUESS_STATS : FIBKING_STATS,
    );
    renderGamesTab();
    await screen.findByText('在库词数');
    fireEvent.click(screen.getByRole('button', { name: '你画我猜' }));
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledWith('drawguess'));
    expect(await screen.findByText('无月配额')).toBeDefined();
    expect(screen.getByText('「你画我猜」无月配额限制')).toBeDefined();
    // Raw enum values are localized: animals -> 动物.
    expect(screen.getByText('动物')).toBeDefined();
    expect(screen.queryByText('animals')).toBeNull();
    // Non-fibking leaderboard uses the generic per-category output title.
    expect(screen.getByText('各分类产出')).toBeDefined();
    expect(screen.getByText('动物（active 题目）')).toBeDefined();
  });

  it('confirms and triggers a normal supply run', async () => {
    renderGamesTab();
    fireEvent.click(await screen.findByRole('button', { name: '补词' }));
    expect(alertText().title).toBe('确认补词');
    expect(alertText().message).toMatch(/为「瞎掰王」立即触发一次补词/);
    pressAlertConfirm();
    await waitFor(() => expect(triggerSupplyMock).toHaveBeenCalledWith('fibking', false));
    // Reloads stats after the trigger.
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledTimes(2));
  });

  it('warns about the monthly quota on force trigger', async () => {
    renderGamesTab();
    fireEvent.click(await screen.findByRole('button', { name: '强制补词' }));
    expect(alertText().title).toBe('确认补词');
    expect(alertText().message).toMatch(/突破本月 60 次配额/);
    pressAlertConfirm();
    await waitFor(() => expect(triggerSupplyMock).toHaveBeenCalledWith('fibking', true));
  });

  it('triggers ten serial normal supply runs on 补词×10', async () => {
    renderGamesTab();
    fireEvent.click(await screen.findByRole('button', { name: '补词×10' }));
    expect(alertText().title).toBe('确认补词');
    expect(alertText().message).toMatch(/将为「瞎掰王」连续触发 10 次补词，确定吗？/);
    expect(alertText().message).not.toMatch(/连续强制触发/);
    pressAlertConfirm();
    await waitFor(() => expect(triggerSupplyMock).toHaveBeenCalledTimes(10));
    expect(triggerSupplyMock).toHaveBeenCalledWith('fibking', false);
    expect(triggerSupplyMock).not.toHaveBeenCalledWith('fibking', true);
    // Reloads stats after the batch completes.
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledTimes(2));
  });

  it('triggers ten serial force supply runs on 强制补词×10', async () => {
    renderGamesTab();
    fireEvent.click(await screen.findByRole('button', { name: '强制补词×10' }));
    expect(alertText().title).toBe('确认补词');
    expect(alertText().message).toMatch(/将为「瞎掰王」连续强制触发 10 次补词/);
    pressAlertConfirm();
    await waitFor(() => expect(triggerSupplyMock).toHaveBeenCalledTimes(10));
    expect(triggerSupplyMock).toHaveBeenCalledWith('fibking', true);
    // Reloads stats after the batch completes.
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledTimes(2));
  });

  it('uses the daily batch wording for undercover force trigger', async () => {
    renderGamesTab();
    await screen.findByText('在库词数');
    fireEvent.click(screen.getByRole('button', { name: '谁是卧底' }));
    fireEvent.click(await screen.findByRole('button', { name: '强制补词' }));
    expect(fetchStatsMock).toHaveBeenCalledWith('undercover');
    expect(alertText().message).toMatch(/将为「谁是卧底」强制触发一次补词，突破每日批次上限/);
  });

  it('shows localized category names and the full query leaderboard', async () => {
    renderGamesTab();
    await screen.findByText('在库词数');
    // Raw enum values are localized: literary -> 书面词.
    expect(screen.getByText('书面词')).toBeDefined();
    expect(screen.queryByText('literary')).toBeNull();
    // No Top-12 cut: the full leaderboard renders as a list.
    expect(screen.getByText('各查询产出榜（全部 1 条）')).toBeDefined();
    expect(screen.getByText('5/2批')).toBeDefined();
  });

  it('paginates the fibking query leaderboard at 15 rows per page', async () => {
    fetchStatsMock.mockResolvedValue({ ...FIBKING_STATS, queryLeaderboard: manyLeaderboardRows() });
    renderGamesTab();
    expect(await screen.findByText('各查询产出榜（全部 16 条）')).toBeDefined();
    // First page shows 15 rows.
    expect(screen.getByText('1 / 2')).toBeDefined();
    expect(screen.getByText('查询1')).toBeDefined();
    expect(screen.queryByText('查询16')).toBeNull();
    // Next page shows the remaining row.
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('2 / 2')).toBeDefined();
    expect(screen.getByText('查询16')).toBeDefined();
    expect(screen.queryByText('查询1')).toBeNull();
    // Previous page goes back.
    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    expect(screen.getByText('1 / 2')).toBeDefined();
    expect(screen.getByText('查询1')).toBeDefined();
  });

  it('resets the leaderboard page when switching games', async () => {
    fetchStatsMock.mockImplementation(async (game: GameWordGame) =>
      game === 'undercover'
        ? UNDERCOVER_STATS
        : { ...FIBKING_STATS, queryLeaderboard: manyLeaderboardRows() },
    );
    renderGamesTab();
    expect(await screen.findByText('各查询产出榜（全部 16 条）')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('2 / 2')).toBeDefined();
    // Switching games resets the page to 1.
    fireEvent.click(screen.getByRole('button', { name: '谁是卧底' }));
    await waitFor(() => expect(fetchStatsMock).toHaveBeenCalledWith('undercover'));
    fireEvent.click(screen.getByRole('button', { name: '瞎掰王' }));
    expect(await screen.findByText('1 / 2')).toBeDefined();
    expect(screen.getByText('查询1')).toBeDefined();
  });

  it('shows an error state when loading fails', async () => {
    fetchStatsMock.mockRejectedValue(new Error('boom'));
    renderGamesTab();
    expect(await screen.findByText('boom')).toBeDefined();
  });
});

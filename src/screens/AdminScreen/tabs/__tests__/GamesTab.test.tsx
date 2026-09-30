/** Games tab: game switching, stats display, and supply triggers. */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { GameWordsStats } from '@/features/admin/model/adminContracts';

import { GamesTab } from '../GamesTab';

const mockFetchGameWordsStats = jest.fn<Promise<GameWordsStats>, [string]>();
const mockTriggerGameWordSupply = jest.fn<Promise<unknown>, [string, boolean]>();

jest.mock('@/features/admin/services/adminApi', () => ({
  fetchGameWordsStats: (game: string) => mockFetchGameWordsStats(game),
  triggerGameWordSupply: (game: string, force: boolean) => mockTriggerGameWordSupply(game, force),
}));

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

/** Press the modal's 确定 button. The modal renders title/message/buttons as real UI. */
function pressModalConfirm() {
  fireEvent.press(screen.getByText('确定'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchGameWordsStats.mockImplementation(async (game: string) =>
    game === 'undercover' ? UNDERCOVER_STATS : FIBKING_STATS,
  );
  mockTriggerGameWordSupply.mockResolvedValue({ game: 'fibking', force: false, workflowId: 'x' });
});

describe('GamesTab', () => {
  it('loads fibking stats by default', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('在库词数')).toBeTruthy());
    expect(mockFetchGameWordsStats).toHaveBeenCalledWith('fibking');
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByText('25/500')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('本月剩余 30 次（配额 60） · Tavily 本月已用 128/1000')).toBeTruthy();
    expect(screen.getByText('5/2批')).toBeTruthy();
  });

  it('shows the review rejection breakdown for fibking', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('审核拒因分布（近 30 天）')).toBeTruthy());
    expect(screen.getByText('释义准确 不通过')).toBeTruthy();
    expect(screen.getByText('真义陌生 不通过')).toBeTruthy();
  });

  it('switches to undercover and shows its stats without a monthly budget', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('在库词数')).toBeTruthy());
    fireEvent.press(screen.getByText('谁是卧底'));
    await waitFor(() => expect(mockFetchGameWordsStats).toHaveBeenCalledWith('undercover'));
    expect(screen.getByText('无月配额')).toBeTruthy();
    expect(screen.getByText('谁是卧底无月配额限制')).toBeTruthy();
  });

  it('confirms and triggers a normal supply run', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('补词')).toBeTruthy());
    fireEvent.press(screen.getByText('补词'));
    expect(screen.getByText('确认补词')).toBeTruthy();
    expect(screen.getByText(/为「瞎掰王」立即触发一次补词/)).toBeTruthy();
    pressModalConfirm();
    await waitFor(() => expect(mockTriggerGameWordSupply).toHaveBeenCalledWith('fibking', false));
    // Reloads stats after the trigger.
    await waitFor(() => expect(mockFetchGameWordsStats).toHaveBeenCalledTimes(2));
  });

  it('warns about the monthly quota on force trigger', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('强制补词')).toBeTruthy());
    fireEvent.press(screen.getByText('强制补词'));
    expect(screen.getByText('确认补词')).toBeTruthy();
    expect(screen.getByText(/突破本月 60 次配额/)).toBeTruthy();
    pressModalConfirm();
    await waitFor(() => expect(mockTriggerGameWordSupply).toHaveBeenCalledWith('fibking', true));
  });

  it('shows localized category names and the full query leaderboard', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('在库词数')).toBeTruthy());
    // Raw enum values are localized: literary -> 书面词.
    expect(screen.getByText('书面词')).toBeTruthy();
    expect(screen.queryByText('literary')).toBeNull();
    // No Top-12 cut: the full leaderboard renders as a list.
    expect(screen.getByText('各查询产出榜（全部 1 条）')).toBeTruthy();
    expect(screen.getByText('5/2批')).toBeTruthy();
  });

  it('paginates the fibking query leaderboard at 15 rows per page', async () => {
    const manyRows = Array.from({ length: 16 }, (_, i) => ({
      label: `查询${i + 1}`,
      detail: null,
      publishedWords: 16 - i,
      packs: 1,
    }));
    mockFetchGameWordsStats.mockResolvedValue({ ...FIBKING_STATS, queryLeaderboard: manyRows });
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('各查询产出榜（全部 16 条）')).toBeTruthy());
    // First page shows 15 rows.
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('查询1')).toBeTruthy();
    expect(screen.queryByText('查询16')).toBeNull();
    // Next page shows the remaining row.
    fireEvent.press(screen.getByLabelText('下一页'));
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText('查询16')).toBeTruthy();
    expect(screen.queryByText('查询1')).toBeNull();
    // Previous page goes back.
    fireEvent.press(screen.getByLabelText('上一页'));
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('查询1')).toBeTruthy();
  });

  it('resets the leaderboard page when switching games', async () => {
    const manyRows = Array.from({ length: 16 }, (_, i) => ({
      label: `查询${i + 1}`,
      detail: null,
      publishedWords: 16 - i,
      packs: 1,
    }));
    mockFetchGameWordsStats.mockImplementation(async (game: string) =>
      game === 'undercover' ? UNDERCOVER_STATS : { ...FIBKING_STATS, queryLeaderboard: manyRows },
    );
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('各查询产出榜（全部 16 条）')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('下一页'));
    expect(screen.getByText('2 / 2')).toBeTruthy();
    // Switching games resets the page to 1.
    fireEvent.press(screen.getByText('谁是卧底'));
    await waitFor(() => expect(mockFetchGameWordsStats).toHaveBeenCalledWith('undercover'));
    fireEvent.press(screen.getByText('瞎掰王'));
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy());
    expect(screen.getByText('查询1')).toBeTruthy();
  });

  it('shows an error state when loading fails', async () => {
    mockFetchGameWordsStats.mockRejectedValue(new Error('boom'));
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
  });
});

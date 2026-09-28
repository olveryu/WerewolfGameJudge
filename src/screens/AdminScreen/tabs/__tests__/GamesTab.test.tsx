/** Games tab: game switching, stats display, and supply triggers. */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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
  reviewDecisions: [
    { decision: 'accepted', count: 8 },
    { decision: 'rejected', count: 2 },
  ],
  queryLeaderboard: [{ label: '跳舞草', detail: '植物', publishedWords: 5, packs: 2 }],
  supplyEnabled: true,
};

const UNDERCOVER_STATS: GameWordsStats = {
  game: 'undercover',
  wordsByCategory: [{ category: 'daily', active: 20, total: 20 }],
  monthlySupply: null,
  reviewDecisions: [],
  queryLeaderboard: [{ label: 'daily', detail: null, publishedWords: 20, packs: 4 }],
  supplyEnabled: true,
};

const alertSpy = jest.spyOn(Alert, 'alert');

function pressAlertConfirm() {
  const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  if (!lastCall) throw new Error('Alert not called');
  const buttons = lastCall[2];
  if (!buttons) throw new Error('Alert buttons missing');
  const confirm = buttons.find((b) => b.text === '确定');
  const onPress = confirm?.onPress;
  if (!onPress) throw new Error('Confirm button missing');
  act(() => {
    onPress();
  });
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
    expect(screen.getByText('本月剩余 30 次（配额 60）')).toBeTruthy();
    expect(screen.getByText('5/2批')).toBeTruthy();
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
    expect(alertSpy).toHaveBeenCalledWith(
      '确认补词',
      expect.stringContaining('瞎掰王'),
      expect.anything(),
    );
    pressAlertConfirm();
    await waitFor(() => expect(mockTriggerGameWordSupply).toHaveBeenCalledWith('fibking', false));
    // Reloads stats after the trigger.
    await waitFor(() => expect(mockFetchGameWordsStats).toHaveBeenCalledTimes(2));
  });

  it('warns about quota and cost on force trigger', async () => {
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('强制补词')).toBeTruthy());
    fireEvent.press(screen.getByText('强制补词'));
    expect(alertSpy).toHaveBeenCalledWith(
      '确认补词',
      expect.stringContaining('突破本月 60 次配额并产生额外 Tavily/Gemini 费用'),
      expect.anything(),
    );
    pressAlertConfirm();
    await waitFor(() => expect(mockTriggerGameWordSupply).toHaveBeenCalledWith('fibking', true));
  });

  it('shows an error state when loading fails', async () => {
    mockFetchGameWordsStats.mockRejectedValue(new Error('boom'));
    render(<GamesTab />);
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
  });
});

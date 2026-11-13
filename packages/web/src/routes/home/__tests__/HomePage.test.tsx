/** Home: create / join entries, hero folding, guide entry, announcements and the ticket badge. */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

import type { ClientGameModeOption } from '@/games/catalog';
import { TESTIDS } from '@/testids';

const mocks = vi.hoisted(() => ({
  modeOptions: [] as ClientGameModeOption[],
  appVersion: 'v2.9.0',
  useAuthContext: vi.fn(),
  useUnreadFeedback: vi.fn(),
  useGachaStatusQuery: vi.fn(),
  hasSeenAnnouncement: vi.fn(),
  markAnnouncementSeen: vi.fn(),
  requestLogin: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: mocks.useAuthContext }));
vi.mock('@/features/auth/loginRequests', () => ({ requestLogin: mocks.requestLogin }));
vi.mock('@/features/feedback/queries/useUnreadFeedback', () => ({
  useUnreadFeedback: mocks.useUnreadFeedback,
}));
vi.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: mocks.useGachaStatusQuery,
}));
vi.mock('@/features/home/services/announcementReceiptStore', () => ({
  hasSeenAnnouncement: mocks.hasSeenAnnouncement,
  markAnnouncementSeen: mocks.markAnnouncementSeen,
}));

const SIGNED_IN = {
  user: {
    id: 'test-user',
    displayName: 'Test',
    email: null,
    avatarUrl: null,
    isAnonymous: false,
  },
  loading: false,
  error: null,
};

function HeroIcon() {
  return <svg data-testid="hero-icon" />;
}

function modeOption(index: number): ClientGameModeOption {
  return {
    // Synthetic game types keep the hero keys unique; only the count matters here.
    gameType: `game-${index}` as GameType,
    displayName: `游戏${index + 1}`,
    subtitle: '副标题',
    Icon: HeroIcon,
    tier: 'main',
    gradient: ['#818CF8', '#4F46E5'],
  };
}

function setModeOptionCount(count: number) {
  mocks.modeOptions = Array.from({ length: count }, (_, index) => modeOption(index));
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

/** Imports Home fresh so its module-level hero folding sees the current mode options and version. */
async function renderHome() {
  vi.resetModules();
  vi.doMock('@/games/catalog', () => ({
    GAME_MODE_OPTIONS: mocks.modeOptions,
    GAME_HOME_SPOTLIGHTS: [],
    GAME_ANNOUNCEMENT_TABS: [],
  }));
  vi.doMock('@/config/version', () => ({ APP_VERSION: mocks.appVersion }));
  const { HomePage } = await import('../HomePage');
  const router = createMemoryRouter([
    { path: '/', Component: HomePage },
    { path: '*', Component: LocationProbe },
  ]);
  render(<RouterProvider router={router} />);
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModeOptionCount(1);
    mocks.appVersion = 'v2.9.0';
    mocks.useAuthContext.mockReturnValue({ user: null, loading: false, error: null });
    mocks.useUnreadFeedback.mockReturnValue({
      data: undefined,
      isError: false,
      setUnreadFeedbackCount: vi.fn(),
    });
    mocks.useGachaStatusQuery.mockReturnValue({ data: undefined });
    mocks.hasSeenAnnouncement.mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('renders the main menu items', async () => {
      await renderHome();

      expect(screen.getByText('创建房间')).toBeInTheDocument();
      expect(screen.getByText('进入房间')).toBeInTheDocument();
      expect(screen.getByText('1 款游戏 · 点开挑一款')).toBeInTheDocument();
    });

    it('renders the app title', async () => {
      await renderHome();

      expect(screen.getByText('狼人面杀电子裁判助手')).toBeInTheDocument();
    });

    it('renders the settings entry in the top bar', async () => {
      await renderHome();

      expect(screen.getByTestId(TESTIDS.homeSettingsButton)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('opens the game picker in create purpose when creating a room', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      await renderHome();

      await userEvent.click(screen.getByText('创建房间'));

      expect(await screen.findByTestId('location')).toHaveTextContent('/games?purpose=create');
    });

    it('navigates to settings when the settings entry is pressed', async () => {
      await renderHome();

      await userEvent.click(screen.getByTestId(TESTIDS.homeSettingsButton));

      expect(await screen.findByTestId('location')).toHaveTextContent('/settings');
    });

    it('opens the sole game guide directly', async () => {
      mocks.modeOptions = [{ ...modeOption(0), gameType: 'werewolf' }];
      await renderHome();

      await userEvent.click(screen.getByRole('button', { name: '游戏图鉴' }));

      expect(await screen.findByTestId('location')).toHaveTextContent('/game/werewolf/guide');
    });

    it('opens the game picker in guide purpose when several games exist', async () => {
      setModeOptionCount(2);
      await renderHome();

      await userEvent.click(screen.getByTestId(TESTIDS.homeGuideButton));

      expect(await screen.findByTestId('location')).toHaveTextContent('/games?purpose=guide');
    });
  });

  describe('Hero icon dots folding', () => {
    function heroDotCount() {
      return within(screen.getByTestId(TESTIDS.homeCreateRoomButton)).getAllByTestId('hero-icon')
        .length;
    }

    it('renders every game as a dot at the limit of 8, with no overflow chip', async () => {
      setModeOptionCount(8);
      await renderHome();

      expect(heroDotCount()).toBe(8);
      expect(screen.queryByText(/^\+\d+$/)).toBeNull();
      expect(screen.getByText('8 款游戏 · 点开挑一款')).toBeInTheDocument();
    });

    it('folds the tail into a +N chip past 8: 7 dots and +2 at 9 games', async () => {
      setModeOptionCount(9);
      await renderHome();

      expect(heroDotCount()).toBe(7);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('keeps 7 dots and counts all folded games in the chip at 10 games', async () => {
      setModeOptionCount(10);
      await renderHome();

      expect(heroDotCount()).toBe(7);
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('10 款游戏 · 点开挑一款')).toBeInTheDocument();
    });
  });

  describe('Join Room dialog', () => {
    it('shows the join room dialog when "进入房间" is pressed', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      await renderHome();

      await userEvent.click(screen.getByText('进入房间'));

      expect(await screen.findByText('输入4位房间号码')).toBeInTheDocument();
    });

    it('accepts keyboard input changes and announces invalid submissions', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      await renderHome();
      await userEvent.click(screen.getByText('进入房间'));

      const dialog = await screen.findByTestId(TESTIDS.joinRoomDialog);
      const roomCode = within(dialog).getByRole('textbox', { name: '房间号（4位数字）' });
      await userEvent.type(roomCode, '12');
      fireEvent.change(roomCode, { target: { value: '1234' } });
      expect(roomCode).toHaveValue('1234');

      await userEvent.clear(roomCode);
      await userEvent.click(within(dialog).getByRole('button', { name: '加入' }));

      const error = within(dialog).getByRole('alert');
      expect(error).toHaveTextContent('请输入4位数字房间号');
      expect(roomCode).toHaveAttribute('aria-invalid', 'true');
      expect(roomCode).toHaveAttribute('aria-describedby', error.id);
    });
  });

  describe('Announcements', () => {
    it("auto-shows this version's announcement once and marks it seen on close", async () => {
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      await renderHome();

      expect(await screen.findByText('v2.9.0 更新内容')).toBeInTheDocument();
      expect(mocks.markAnnouncementSeen).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: '关闭公告' }));

      expect(mocks.markAnnouncementSeen).toHaveBeenCalledWith('v2.9.0');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('waits for auth to settle before showing the announcement', async () => {
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      mocks.useAuthContext.mockReturnValue({ user: null, loading: true, error: null });
      await renderHome();

      expect(mocks.hasSeenAnnouncement).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('silently marks a version without an announcement as seen', async () => {
      mocks.appVersion = 'v0.0.1';
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      await renderHome();

      await waitFor(() => expect(mocks.markAnnouncementSeen).toHaveBeenCalledWith('v0.0.1'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the announcement modal from the card', async () => {
      await renderHome();

      await userEvent.click(screen.getByRole('button', { name: /公告与反馈/ }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('shows the unread reply count on the card', async () => {
      mocks.useUnreadFeedback.mockReturnValue({
        data: 3,
        isError: false,
        setUnreadFeedbackCount: vi.fn(),
      });
      await renderHome();

      expect(await screen.findByText('3 条新回复')).toBeInTheDocument();
    });

    it('reports an unread-count failure on the card', async () => {
      mocks.useUnreadFeedback.mockReturnValue({
        data: undefined,
        isError: true,
        setUnreadFeedbackCount: vi.fn(),
      });
      await renderHome();

      expect(await screen.findByText('回复状态读取失败')).toBeInTheDocument();
    });
  });

  describe('Ticket badge', () => {
    it('caps the ticket count at 99+', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      mocks.useGachaStatusQuery.mockReturnValue({ data: { normalDraws: 80, goldenDraws: 40 } });
      await renderHome();

      expect(await screen.findByText('99+')).toBeInTheDocument();
    });

    it('hides the badge without tickets', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      mocks.useGachaStatusQuery.mockReturnValue({ data: { normalDraws: 0, goldenDraws: 0 } });
      await renderHome();

      expect(screen.queryByRole('img', { name: /张抽奖券/ })).toBeNull();
    });
  });
});

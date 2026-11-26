/** Home: create / join entries, hero folding, guide entry, announcements and the ticket badge. */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

import { ACCOUNT_ENTRY_CLASS } from '@/components/avatar/AccountAvatar';
import type { ClientGameModeOption } from '@/games/catalog';
import { TESTIDS } from '@/testids';

import { HomePage } from '../HomePage';

const mocks = vi.hoisted(() => ({
  catalog: {
    GAME_MODE_OPTIONS: [
      {
        gameType: 'werewolf',
        displayName: '游戏1',
        subtitle: '副标题',
        Icon: () => null,
        tier: 'main',
        gradient: ['#818CF8', '#4F46E5'],
      },
    ] as ClientGameModeOption[],
    GAME_HOME_SPOTLIGHTS: [],
    GAME_ANNOUNCEMENT_TABS: [],
  },
  version: { APP_VERSION: 'v2.9.0' },
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
vi.mock('@/games/catalog', () => mocks.catalog);
vi.mock('@/config/version', () => mocks.version);

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
  mocks.catalog.GAME_MODE_OPTIONS = Array.from({ length: count }, (_, index) => modeOption(index));
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderHome(component = HomePage) {
  const router = createMemoryRouter([
    { path: '/', Component: component },
    { path: '*', Component: LocationProbe },
  ]);
  render(<RouterProvider router={router} />);
}

/** Reloads the module only when testing its module-level hero folding. */
async function renderHomeWithFreshCatalog() {
  vi.resetModules();
  const { HomePage: FreshHomePage } = await import('../HomePage');
  renderHome(FreshHomePage);
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModeOptionCount(1);
    mocks.version.APP_VERSION = 'v2.9.0';
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
    it('renders the main menu items', () => {
      renderHome();

      expect(screen.getByText('创建房间')).toBeInTheDocument();
      expect(screen.getByText('进入房间')).toBeInTheDocument();
      expect(screen.getByText('1 款游戏 · 点开挑一款')).toBeInTheDocument();
    });

    it('renders the app title', () => {
      renderHome();

      expect(screen.getByText('狼人面杀电子裁判助手')).toBeInTheDocument();
    });

    it('renders the guide as a tactile key and the account entry as the plain avatar link', () => {
      renderHome();

      expect(screen.getByTestId(TESTIDS.homeGuideButton)).toHaveClass('icon-button');
      const account = screen.getByRole('link', { name: '设置' });
      expect(account).toBe(screen.getByTestId(TESTIDS.homeSettingsButton));
      expect(account).toHaveClass(ACCOUNT_ENTRY_CLASS);
      expect(account).not.toHaveClass('icon-button');
    });

    it('renders the signed-in avatar directly inside the account entry', () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      renderHome();

      const account = screen.getByTestId(TESTIDS.homeSettingsButton);
      // No wrapper between the entry and the avatar may re-shape it.
      expect(within(account).getByRole('img', { name: '头像' }).parentElement).toBe(account);
    });
  });

  describe('Navigation', () => {
    it('opens the game picker in create purpose when creating a room', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      renderHome();

      await userEvent.click(screen.getByText('创建房间'));

      expect(await screen.findByTestId('location')).toHaveTextContent('/games?purpose=create');
    });

    it('navigates to settings when the settings entry is pressed', async () => {
      renderHome();

      await userEvent.click(screen.getByTestId(TESTIDS.homeSettingsButton));

      expect(await screen.findByTestId('location')).toHaveTextContent('/settings');
    });

    it('opens the sole game guide directly', async () => {
      mocks.catalog.GAME_MODE_OPTIONS = [{ ...modeOption(0), gameType: 'werewolf' }];
      renderHome();

      await userEvent.click(screen.getByRole('button', { name: '游戏图鉴' }));

      expect(await screen.findByTestId('location')).toHaveTextContent('/game/werewolf/guide');
    });

    it('opens the game picker in guide purpose when several games exist', async () => {
      setModeOptionCount(2);
      renderHome();

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
      await renderHomeWithFreshCatalog();

      expect(heroDotCount()).toBe(8);
      expect(screen.queryByText(/^\+\d+$/)).toBeNull();
      expect(screen.getByText('8 款游戏 · 点开挑一款')).toBeInTheDocument();
    });

    it('folds the tail into a +N chip past 8: 7 dots and +2 at 9 games', async () => {
      setModeOptionCount(9);
      await renderHomeWithFreshCatalog();

      expect(heroDotCount()).toBe(7);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('keeps 7 dots and counts all folded games in the chip at 10 games', async () => {
      setModeOptionCount(10);
      await renderHomeWithFreshCatalog();

      expect(heroDotCount()).toBe(7);
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('10 款游戏 · 点开挑一款')).toBeInTheDocument();
    });
  });

  describe('Join Room dialog', () => {
    it('shows the join room dialog when "进入房间" is pressed', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      renderHome();

      await userEvent.click(screen.getByText('进入房间'));

      expect(await screen.findByText('输入4位房间号码')).toBeInTheDocument();
    });
  });

  describe('Announcements', () => {
    it("auto-shows this version's announcement once and marks it seen on close", async () => {
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      renderHome();

      expect(await screen.findByText('v2.9.0 更新内容')).toBeInTheDocument();
      expect(mocks.markAnnouncementSeen).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: '关闭公告' }));

      expect(mocks.markAnnouncementSeen).toHaveBeenCalledWith('v2.9.0');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('waits for auth to settle before showing the announcement', () => {
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      mocks.useAuthContext.mockReturnValue({ user: null, loading: true, error: null });
      renderHome();

      expect(mocks.hasSeenAnnouncement).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('silently marks a version without an announcement as seen', async () => {
      mocks.version.APP_VERSION = 'v0.0.1';
      mocks.hasSeenAnnouncement.mockReturnValue(false);
      renderHome();

      await waitFor(() => expect(mocks.markAnnouncementSeen).toHaveBeenCalledWith('v0.0.1'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the announcement modal from the card', async () => {
      renderHome();

      await userEvent.click(screen.getByRole('button', { name: /公告与反馈/ }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('shows the unread reply count on the card', async () => {
      mocks.useUnreadFeedback.mockReturnValue({
        data: 3,
        isError: false,
        setUnreadFeedbackCount: vi.fn(),
      });
      renderHome();

      expect(await screen.findByText('3 条新回复')).toBeInTheDocument();
    });

    it('reports an unread-count failure on the card', async () => {
      mocks.useUnreadFeedback.mockReturnValue({
        data: undefined,
        isError: true,
        setUnreadFeedbackCount: vi.fn(),
      });
      renderHome();

      expect(await screen.findByText('回复状态读取失败')).toBeInTheDocument();
    });
  });

  describe('Ticket badge', () => {
    it('caps the ticket count at 99+', async () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      mocks.useGachaStatusQuery.mockReturnValue({ data: { normalDraws: 80, goldenDraws: 40 } });
      renderHome();

      expect(await screen.findByText('99+')).toBeInTheDocument();
    });

    it('hides the badge without tickets', () => {
      mocks.useAuthContext.mockReturnValue(SIGNED_IN);
      mocks.useGachaStatusQuery.mockReturnValue({ data: { normalDraws: 0, goldenDraws: 0 } });
      renderHome();

      expect(screen.queryByRole('img', { name: /张抽奖券/ })).toBeNull();
    });
  });
});

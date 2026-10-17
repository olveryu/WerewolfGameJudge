import Ionicons from '@expo/vector-icons/Ionicons';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';
import { TESTIDS } from '@/testids';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

const mockClientGameHome = {
  modeOptions: [
    {
      gameType: 'werewolf' as const,
      displayName: '狼人杀',
      subtitle: '经典身份推理',
      iconName: 'moon-outline' as const,
      tier: 'main' as const,
      gradient: ['#818CF8', '#4F46E5'] as const,
    },
  ],
  guideOptions: [
    {
      gameType: 'werewolf' as const,
      displayName: '狼人杀',
      subtitle: '经典身份推理',
      iconName: 'moon-outline' as const,
      tier: 'main' as const,
      gradient: ['#818CF8', '#4F46E5'] as const,
    },
  ],
  spotlights: [],
  announcementTabs: [],
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@/games/ClientGameCatalogContext', () => ({
  useClientGameHome: () => mockClientGameHome,
}));

// Mock useAuth hook
jest.mock('../../../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    refreshUser: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock MMKV storage
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

// Mock utils
jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual<typeof import('../../../utils/alert')>('../../../utils/alert'),
  showAlert: jest.fn(),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render main menu items', () => {
      const { getByText } = render(<HomeScreen />);

      expect(getByText('创建房间')).toBeTruthy();
      expect(getByText('进入房间')).toBeTruthy();
      expect(getByText('1 款游戏 · 点开挑一款')).toBeTruthy();
    });

    it('should render the app title', () => {
      const { getByText } = render(<HomeScreen />);

      expect(getByText('狼人面杀电子裁判助手')).toBeTruthy();
    });

    it('should render settings button in top bar', () => {
      const { getByTestId } = render(<HomeScreen />);

      expect(getByTestId('home-settings-button')).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should open the game picker page in create purpose when creating a room', async () => {
      // Set up authenticated user
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuthContext').mockReturnValue({
        user: { id: 'test-user', displayName: 'Test' },
        loading: false,
        error: null,
        isAuthenticated: true,
        refreshUser: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText } = render(<HomeScreen />);

      fireEvent.press(getByText('创建房间'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('GamePicker', { purpose: 'create' });
      });
    });

    it('should navigate to Settings screen when settings is pressed', () => {
      const { getByTestId } = render(<HomeScreen />);

      fireEvent.press(getByTestId('home-settings-button'));

      expect(mockNavigate).toHaveBeenCalledWith('Settings');
    });
  });

  describe('Hero icon dots folding', () => {
    const originalModeOptions = mockClientGameHome.modeOptions;

    function setModeOptionCount(count: number) {
      mockClientGameHome.modeOptions = Array.from({ length: count }, (_, index) => ({
        gameType: `game-${index}` as 'werewolf',
        displayName: `游戏${index + 1}`,
        subtitle: '副标题',
        iconName: 'moon-outline' as const,
        tier: 'main' as const,
        gradient: ['#818CF8', '#4F46E5'] as const,
      }));
    }

    /** Icon dots rendered inside the hero card (one Ionicons per dot). */
    function heroDotCount(view: ReturnType<typeof render>) {
      const hero = within(view.getByTestId(TESTIDS.homeCreateRoomButton));
      return hero.UNSAFE_getAllByType(Ionicons).filter((icon) => icon.props.name === 'moon-outline')
        .length;
    }

    afterEach(() => {
      mockClientGameHome.modeOptions = originalModeOptions;
    });

    it('renders every game as a dot at the limit of 8, with no overflow chip', () => {
      setModeOptionCount(8);
      const view = render(<HomeScreen />);
      expect(heroDotCount(view)).toBe(8);
      expect(view.queryByText(/^\+\d+$/)).toBeNull();
      expect(view.getByText('8 款游戏 · 点开挑一款')).toBeTruthy();
    });

    it('folds the tail into a +N chip past 8: 7 dots and +2 at 9 games', () => {
      setModeOptionCount(9);
      const view = render(<HomeScreen />);
      expect(heroDotCount(view)).toBe(7);
      expect(view.getByText('+2')).toBeTruthy();
    });

    it('keeps 7 dots and counts all folded games in the chip at 10 games', () => {
      setModeOptionCount(10);
      const view = render(<HomeScreen />);
      expect(heroDotCount(view)).toBe(7);
      expect(view.getByText('+3')).toBeTruthy();
      expect(view.getByText('10 款游戏 · 点开挑一款')).toBeTruthy();
    });
  });

  describe('Join Room Modal', () => {
    it('should show join room modal when "进入房间" is pressed', async () => {
      // Mock authenticated user
      jest.spyOn(require('@/contexts/AuthContext'), 'useAuthContext').mockReturnValue({
        user: { id: 'test-user', displayName: 'Test' },
        loading: false,
        error: null,
        isAuthenticated: true,
        refreshUser: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText, queryByText } = render(<HomeScreen />);

      fireEvent.press(getByText('进入房间'));

      await waitFor(() => {
        expect(queryByText('输入4位房间号码')).toBeTruthy();
      });
    });
  });
});

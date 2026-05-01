import { render } from '@testing-library/react-native';

import type { UserPublicProfile } from '@/services/feature/StatsService';

import { PlayerProfileCard } from '../PlayerProfileCard';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockUseUserProfileQuery = jest.fn<unknown, unknown[]>();
jest.mock('@/hooks/queries/useUserProfileQuery', () => ({
  useUserProfileQuery: (...args: unknown[]) => mockUseUserProfileQuery(...args),
}));

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  targetSeat: 2,
  isHost: false,
  onKick: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: query disabled / no data
  mockUseUserProfileQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  });
});

describe('PlayerProfileCard', () => {
  describe('bot player', () => {
    it('shows roster name and "机器人" label without API call', () => {
      const { getByText, queryByTestId } = render(
        <PlayerProfileCard {...baseProps} targetUserId="bot-2" rosterName="机器人3号" />,
      );

      expect(getByText('机器人3号')).toBeTruthy();
      expect(getByText('机器人')).toBeTruthy();
      // Query should be disabled for bots
      expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
        'bot-2',
        expect.objectContaining({ enabled: false }),
      );
      // No loading spinner
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    it('falls back to seat number if rosterName is empty', () => {
      const { getByText } = render(
        <PlayerProfileCard {...baseProps} targetUserId="bot-2" rosterName="" />,
      );

      expect(getByText('机器人3')).toBeTruthy();
    });

    it('shows kick button for host', () => {
      const { getByText } = render(
        <PlayerProfileCard {...baseProps} targetUserId="bot-2" rosterName="机器人3号" isHost />,
      );

      expect(getByText('移出座位')).toBeTruthy();
    });

    it('hides kick button for non-host', () => {
      const { queryByText } = render(
        <PlayerProfileCard
          {...baseProps}
          targetUserId="bot-2"
          rosterName="机器人3号"
          isHost={false}
        />,
      );

      expect(queryByText('移出座位')).toBeNull();
    });
  });

  describe('real player', () => {
    it('renders profile data returned by useUserProfileQuery', () => {
      const mockProfile: UserPublicProfile = {
        displayName: 'Alice',
        xp: 100,
        level: 2,
        title: '',
        gamesPlayed: 5,
        unlockedItemCount: 3,
      };
      mockUseUserProfileQuery.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        isError: false,
      });

      const { getByText } = render(<PlayerProfileCard {...baseProps} targetUserId="user-abc" />);

      expect(getByText('Alice')).toBeTruthy();
      expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
        'user-abc',
        expect.objectContaining({ enabled: true }),
      );
    });

    it('does not enable query when not visible', () => {
      render(<PlayerProfileCard {...baseProps} visible={false} targetUserId="user-abc" />);

      expect(mockUseUserProfileQuery).toHaveBeenCalledWith(
        'user-abc',
        expect.objectContaining({ enabled: false }),
      );
    });
  });
});

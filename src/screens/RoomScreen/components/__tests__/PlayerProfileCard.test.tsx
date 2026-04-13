import { render, waitFor } from '@testing-library/react-native';

import * as StatsService from '@/services/feature/StatsService';

import { PlayerProfileCard } from '../PlayerProfileCard';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/services/feature/StatsService');

const mockFetchUserProfile = StatsService.fetchUserProfile as jest.MockedFunction<
  typeof StatsService.fetchUserProfile
>;

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  targetSeat: 2,
  isHost: false,
  onKick: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PlayerProfileCard', () => {
  describe('bot player', () => {
    it('shows roster name and "机器人" label without API call', () => {
      const { getByText, queryByTestId } = render(
        <PlayerProfileCard {...baseProps} targetUid="bot-2" rosterName="机器人3号" />,
      );

      expect(getByText('机器人3号')).toBeTruthy();
      expect(getByText('机器人')).toBeTruthy();
      expect(mockFetchUserProfile).not.toHaveBeenCalled();
      // No loading spinner
      expect(queryByTestId('loading-indicator')).toBeNull();
    });

    it('falls back to seat number if rosterName is empty', () => {
      const { getByText } = render(
        <PlayerProfileCard {...baseProps} targetUid="bot-2" rosterName="" />,
      );

      expect(getByText('机器人3')).toBeTruthy();
    });

    it('shows kick button for host', () => {
      const { getByText } = render(
        <PlayerProfileCard {...baseProps} targetUid="bot-2" rosterName="机器人3号" isHost />,
      );

      expect(getByText('移出座位')).toBeTruthy();
    });

    it('hides kick button for non-host', () => {
      const { queryByText } = render(
        <PlayerProfileCard
          {...baseProps}
          targetUid="bot-2"
          rosterName="机器人3号"
          isHost={false}
        />,
      );

      expect(queryByText('移出座位')).toBeNull();
    });
  });

  describe('real player', () => {
    it('fetches profile via API for non-bot uid', async () => {
      const mockProfile: StatsService.UserPublicProfile = {
        displayName: 'Alice',
        xp: 100,
        level: 2,
        title: '',
        gamesPlayed: 5,
        unlockedItemCount: 3,
      };
      mockFetchUserProfile.mockResolvedValue(mockProfile);

      const { getByText } = render(<PlayerProfileCard {...baseProps} targetUid="user-abc" />);

      await waitFor(() => {
        expect(getByText('Alice')).toBeTruthy();
      });
      expect(mockFetchUserProfile).toHaveBeenCalledWith('user-abc');
    });

    it('does not fetch when not visible', () => {
      render(<PlayerProfileCard {...baseProps} visible={false} targetUid="user-abc" />);

      expect(mockFetchUserProfile).not.toHaveBeenCalled();
    });
  });
});

/**
 * Audio Guard UI Test
 *
 * Tests that UI interactions are properly blocked when isAudioPlaying=true.
 * All existing board tests use isAudioPlaying=false — this file covers the guard.
 *
 * Verifies:
 * - Seat taps do NOT trigger dialogs when audio is playing
 * - Bottom action buttons are NOT rendered when audio is playing
 */

import { render, waitFor } from '@testing-library/react-native';

import {
  createGameRoomMock,
  createShowAlertMock,
  mockNavigation,
  RoomScreenTestHarness,
  tapSeat,
  waitForRoomScreen,
} from '@/screens/RoomScreen/__tests__/harness';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { showAlert } from '@/utils/alert';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('@/screens/RoomScreen/__tests__/harness');
  return { SafeAreaView: MockSafeAreaView };
});

jest.mock('../../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

jest.mock('../../useRoomSeatDialogs', () => ({
  useRoomSeatDialogs: () => ({
    showEnterSeatDialog: jest.fn(),
    showLeaveSeatDialog: jest.fn(),
    handleConfirmSeat: jest.fn(),
    handleCancelSeat: jest.fn(),
    handleConfirmLeave: jest.fn(),
    handleLeaveRoom: jest.fn(),
  }),
}));

jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

// =============================================================================
// Test Setup
// =============================================================================

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe('Audio Guard (isAudioPlaying=true)', () => {
  const renderRoom = () =>
    render(
      <RoomScreen
        route={{ params: { roomNumber: '1234', isHost: false } } as any}
        navigation={mockNavigation as any}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  describe('seat tap blocked during audio', () => {
    it('seer seat tap produces no dialog when isAudioPlaying=true', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        isAudioPlaying: true,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      // Wait a tick and verify no action-related dialog appeared
      await new Promise((r) => setTimeout(r, 100));
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('actionPrompt')).toBe(false);
    });

    it('wolf seat tap produces no dialog when isAudioPlaying=true', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        isAudioPlaying: true,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await new Promise((r) => setTimeout(r, 100));
      expect(harness.hasSeen('wolfVote')).toBe(false);
    });
  });

  describe('bottom action buttons hidden during audio', () => {
    it('seer skip button is not visible when isAudioPlaying=true', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        isAudioPlaying: true,
      });

      const { queryByText } = renderRoom();

      // The skip button text should not be rendered
      const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
      const skipText = getSchema('seerCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');

      // Wait a bit for render
      await new Promise((r) => setTimeout(r, 100));
      expect(queryByText(skipText)).toBeNull();
    });

    it('wolf empty knife button is not visible when isAudioPlaying=true', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        isAudioPlaying: true,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
      });

      const { queryByText } = renderRoom();

      const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
      const emptyText = getSchema('wolfKill').ui?.emptyVoteText;
      if (!emptyText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');

      await new Promise((r) => setTimeout(r, 100));
      expect(queryByText(emptyText)).toBeNull();
    });
  });

  describe('audio off → interactions work normally', () => {
    it('seer seat tap works when isAudioPlaying=false (control test)', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        isAudioPlaying: false,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });
});

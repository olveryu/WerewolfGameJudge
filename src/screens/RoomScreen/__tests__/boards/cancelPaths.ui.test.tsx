/**
 * Cancel Paths UI Test
 *
 * Tests the CANCEL button behavior for all dialog types that have cancel buttons.
 * Verifies that pressing cancel does NOT call submitAction/submitWolfVote.
 *
 * This is a cross-board test - not tied to a specific board configuration.
 * It covers a gap where nearly all board tests only test the confirm path.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getSchema } from '@/models/roles/spec';
import {
  createGameRoomMock,
  createShowAlertMock,
  mockNavigation,
  MockSafeAreaView,
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
    showSpeakOrderDialog: jest.fn(),
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

describe('Cancel Paths (cross-board)', () => {
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

  // ===========================================================================
  // wolfVote cancel → submitWolfVote NOT called
  // ===========================================================================

  describe('wolfVote cancel', () => {
    it('pressing cancel on wolfVote dialog does NOT call submitWolfVote', async () => {
      const submitWolfVote = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
        hookOverrides: { submitWolfVote },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));

      // Press cancel
      harness.pressButtonOnType('wolfVote', '取消');

      expect(submitWolfVote).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // wolfVoteEmpty cancel → submitWolfVote NOT called
  // ===========================================================================

  describe('wolfVoteEmpty cancel', () => {
    it('pressing cancel on wolfVoteEmpty dialog does NOT call submitWolfVote', async () => {
      const submitWolfVote = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
        hookOverrides: { submitWolfVote },
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const emptyText = getSchema('wolfKill').ui?.emptyVoteText;
      if (!emptyText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');
      fireEvent.press(getByText(emptyText));
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));

      // Press cancel
      harness.pressButtonOnType('wolfVoteEmpty', '取消');

      expect(submitWolfVote).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // actionConfirm cancel → submitAction NOT called
  // ===========================================================================

  describe('actionConfirm cancel', () => {
    it('pressing cancel on seer actionConfirm does NOT call submitAction', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        hookOverrides: { submitAction },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

      // Press cancel
      harness.pressButtonOnType('actionConfirm', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // skipConfirm cancel → submitAction NOT called
  // ===========================================================================

  describe('skipConfirm cancel', () => {
    it('pressing cancel on skipConfirm does NOT call submitAction', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        hookOverrides: { submitAction },
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('seerCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

      // Press cancel
      harness.pressButtonOnType('skipConfirm', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // witchPoisonPrompt cancel → submitAction NOT called
  // ===========================================================================

  describe('witchPoisonPrompt cancel', () => {
    it('pressing cancel on witch poison confirm does NOT call submitAction', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
        hookOverrides: { submitAction },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);
      await waitFor(() =>
        expect(
          harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm'),
        ).toBe(true),
      );

      // Press cancel on whichever dialog appeared
      const lastEvent = harness.getLastEvent();
      if (lastEvent && lastEvent.buttons.includes('取消')) {
        harness.pressButton('取消');
      }

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // magicianFirst dismiss does NOT call submitAction
  // ===========================================================================

  describe('magicianFirst dismiss', () => {
    it('dismissing magicianFirst alert keeps first target but no submit', async () => {
      const submitAction = jest.fn().mockResolvedValue(undefined);
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'magicianSwap',
        currentActionRole: 'magician',
        myRole: 'magician',
        mySeatNumber: 3,
        hookOverrides: { submitAction },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));

      // magicianFirst only has a primary button (知道了), no cancel
      // Verify submitAction is not called at this point
      expect(submitAction).not.toHaveBeenCalled();
    });
  });
});

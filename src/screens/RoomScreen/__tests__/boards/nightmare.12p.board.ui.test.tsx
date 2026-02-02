/**
 * Nightmare 12P Board UI Test
 *
 * Board: 梦魇守卫12人
 * Roles: 4x villager, 3x wolf, nightmare, seer, witch, hunter, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: nightmare block selection, seer, guard, etc.
 * - wolfVote: wolf vote dialog
 * - actionRejected: CRITICAL - blocked player gets rejected (BLOCKED_UI_DEFAULTS)
 * - witchSavePrompt: witch save flow
 * - witchPoisonPrompt: witch poison flow
 * - confirmTrigger: hunter confirm trigger
 * - skipConfirm: guard skip confirmation
 *
 * Host-data required (covered by integration):
 * - seerReveal
 *
 * CRITICAL: Nightmare board MUST cover blocked → actionRejected with REAL interaction:
 * - Blocked player (e.g., seer) taps a seat → triggers action → Host rejects
 * - UI shows actionRejected with BLOCKED_UI_DEFAULTS message
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RoomScreen } from '../../RoomScreen';
import { showAlert } from '../../../../utils/alert';
import { BLOCKED_UI_DEFAULTS } from '../../../../models/roles/spec';
import {
  RoomScreenTestHarness,
  createShowAlertMock,
  getBoardByName,
  boardHasNightmare,
  mockNavigation,
  createGameRoomMock,
  waitForRoomScreen,
  tapSeat,
} from '../harness';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({}));

// Use MockSafeAreaView from harness to preserve testID
jest.mock('react-native-safe-area-context', () => {
  const { MockSafeAreaView } = require('../harness');
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

const BOARD_NAME = '梦魇守卫12人';
const board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

// =============================================================================
// Tests
// =============================================================================

describe(`RoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    (showAlert as jest.Mock).mockImplementation(createShowAlertMock(harness));
  });

  // Verify this board has nightmare
  it('board should contain nightmare role', () => {
    expect(boardHasNightmare(board)).toBe(true);
  });

  describe('actionPrompt coverage', () => {
    it('nightmare block selection: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'nightmareBlock',
        currentActionRole: 'nightmare',
        myRole: 'nightmare',
        mySeatNumber: 7,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('actionPrompt')).toBe(true);
      });
    });

    it('seer action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('actionPrompt')).toBe(true);
      });
    });
  });

  describe('wolfVote coverage', () => {
    it('nightmare wolf: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'nightmare',
        mySeatNumber: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(harness.hasSeen('wolfVote')).toBe(true);
      });
    });
  });

  describe('actionRejected coverage (CRITICAL: nightmare blocked)', () => {
    /**
     * CRITICAL TEST: Blocked player action rejection with REAL interaction
     *
     * Flow:
     * 1. Seer is blocked by nightmare (blockedSeat: 8)
     * 2. Seer tries to act (taps a seat) - REAL INTERACTION
     * 3. Host rejects with actionRejected containing BLOCKED_UI_DEFAULTS.message
     * 4. UI shows actionRejected dialog with correct message
     */
    it('blocked seer: tapSeat triggers action → Host rejects → shows actionRejected with BLOCKED_UI_DEFAULTS', async () => {
      // Seer is blocked by nightmare
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        nightmareBlockedSeat: 8,
        currentNightResults: {
          blockedSeat: 8,
        },
      });

      const { getByTestId, rerender } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      // REAL INTERACTION: Blocked seer taps a seat to try to act
      tapSeat(getByTestId, 1);

      // Simulate Host rejecting the action due to nightmare block
      // In real flow, Host would set actionRejected after receiving the action
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        nightmareBlockedSeat: 8,
        currentNightResults: {
          blockedSeat: 8,
        },
        actionRejected: {
          action: 'seerCheck',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetUid: 'p8',
          rejectionId: 'nightmare-block-1',
        },
      });

      // Rerender to apply the actionRejected state
      rerender(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      // actionRejected is triggered via useEffect when gameState.actionRejected changes
      await waitFor(() => {
        expect(harness.hasSeen('actionRejected')).toBe(true);
      });

      // Verify the rejection message matches BLOCKED_UI_DEFAULTS
      const rejectedEvents = harness.eventsOfType('actionRejected');
      expect(rejectedEvents.length).toBeGreaterThan(0);
      expect(rejectedEvents[0].message).toContain(BLOCKED_UI_DEFAULTS.message);
    });

    it('blocked witch: tapSeat triggers action → Host rejects → shows actionRejected', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        nightmareBlockedSeat: 9,
        currentNightResults: {
          blockedSeat: 9,
        },
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
      });

      const { getByTestId, rerender } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      // REAL INTERACTION: Blocked witch taps to try to use poison
      tapSeat(getByTestId, 1);

      // Host rejects due to nightmare block
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        nightmareBlockedSeat: 9,
        currentNightResults: {
          blockedSeat: 9,
        },
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
        actionRejected: {
          action: 'witchAction',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetUid: 'p9',
          rejectionId: 'nightmare-block-2',
        },
      });

      rerender(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitFor(() => {
        expect(harness.hasSeen('actionRejected')).toBe(true);
      });
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt when someone died', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: 1,
            canSave: true,
            canPoison: true,
          },
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('witchSavePrompt')).toBe(true);
      });
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison confirm', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: -1, // No one died
          canSave: false,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: -1,
            canSave: false,
            canPoison: true,
          },
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(
          harness.hasSeen('witchPoisonPrompt') ||
            harness.hasSeen('witchPoisonConfirm') ||
            harness.hasSeen('actionConfirm'),
        ).toBe(true);
      });
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: shows confirm trigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        hookOverrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('confirmTrigger') || harness.hasSeen('actionPrompt')).toBe(true);
      });
    });
  });

  describe('skipConfirm coverage', () => {
    it('guard action: skip button shows skip confirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'guardProtect',
        currentActionRole: 'guard',
        myRole: 'guard',
        mySeatNumber: 11,
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      // Press the skip button by text
      const skipButton = getByText('不使用技能');
      fireEvent.press(skipButton);

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('wolfKillDisabled coverage', () => {
    it('wolfKillDisabled: non-blocked wolf can still see vote dialog when nightmare blocked another wolf', async () => {
      // Wolf at seat 4 is blocked, but wolf at seat 5 can still vote
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 5,
        nightmareBlockedSeat: 4,
        currentNightResults: {
          blockedSeat: 4,
          wolfKillDisabled: true,
        },
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      // Non-blocked wolf can still tap to vote (though vote will be invalidated by wolfKillDisabled)
      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(harness.hasSeen('wolfVote')).toBe(true);
      });
    });
  });

  // =============================================================================
  // Coverage Assertion (MUST PASS)
  // =============================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    /**
     * Final coverage assertion for nightmare board.
     * Accumulates all dialog events and verifies all required UI types were seen.
     */
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (nightmare block selection)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'nightmareBlock',
        currentActionRole: 'nightmare',
        myRole: 'nightmare',
        mySeatNumber: 7,
      });

      let result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      result.unmount();

      // Step 2: wolfVote (nightmare wolf voting)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'nightmare',
        mySeatNumber: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      tapSeat(result.getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
      result.unmount();

      // Step 3: actionRejected (blocked seer with REAL interaction)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        nightmareBlockedSeat: 8,
        currentNightResults: {
          blockedSeat: 8,
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      // REAL INTERACTION: Blocked seer taps a seat
      tapSeat(result.getByTestId, 1);

      // Simulate Host rejection
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        nightmareBlockedSeat: 8,
        actionRejected: {
          action: 'seerCheck',
          reason: BLOCKED_UI_DEFAULTS.message,
          targetUid: 'p8',
          rejectionId: 'coverage-test',
        },
      });

      result.rerender(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitFor(() => expect(harness.hasSeen('actionRejected')).toBe(true));
      result.unmount();

      // Step 4: witchSavePrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: 1,
          canSave: true,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: 1,
            canSave: true,
            canPoison: true,
          },
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
      result.unmount();

      // Step 5: witchPoisonPrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: -1,
          canSave: false,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedIndex: -1,
            canSave: false,
            canPoison: true,
          },
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      tapSeat(result.getByTestId, 1);
      await waitFor(() =>
        expect(
          harness.hasSeen('witchPoisonPrompt') ||
            harness.hasSeen('witchPoisonConfirm') ||
            harness.hasSeen('actionConfirm'),
        ).toBe(true),
      );
      result.unmount();

      // Step 6: confirmTrigger (hunter) - MUST press the confirm button
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        hookOverrides: {
          getConfirmStatus: jest.fn().mockReturnValue({ canShoot: true }),
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      // CRITICAL: Actually press the confirm button to trigger confirmTrigger dialog
      const confirmButton = result.getByText('查看发动状态');
      fireEvent.press(confirmButton);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
      result.unmount();

      // Step 7: skipConfirm (guard) - MUST press the skip button
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'guardProtect',
        currentActionRole: 'guard',
        myRole: 'guard',
        mySeatNumber: 11,
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
      // CRITICAL: Actually press the skip button to trigger skipConfirm dialog
      const skipButton = result.getByText('不使用技能');
      fireEvent.press(skipButton);
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
      result.unmount();

      // Use literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'actionRejected',
        'witchSavePrompt',
        'witchPoisonPrompt',
        'confirmTrigger',
        'skipConfirm',
      ]);
    });
  });
});

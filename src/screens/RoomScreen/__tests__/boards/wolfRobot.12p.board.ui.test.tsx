/**
 * WolfRobot 12P Board UI Test
 *
 * Board: 机械狼通灵师12人
 * Roles: 4x villager, 3x wolf, wolfRobot, psychic, witch, hunter, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: wolfRobot learn step, psychic check
 * - wolfVote: wolf vote dialog
 * - wolfRobotHunterStatus: hunter gate dialog when wolfRobot learns hunter
 * - witchSavePrompt: witch save flow
 * - witchPoisonPrompt: witch poison flow
 * - confirmTrigger: hunter confirm trigger
 * - skipConfirm: guard skip confirmation
 *
 * Host-data required (covered by integration):
 * - wolfRobotReveal, psychicReveal
 *
 * SPECIAL: Hunter gate MUST use pressPrimary + assertNoLoop
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { RoomScreen } from '../../RoomScreen';
import { showAlert } from '../../../../utils/alert';
import {
  RoomScreenTestHarness,
  createShowAlertMock,
  getBoardByName,
  mockNavigation,
  createGameRoomMock,
  createReactiveGameRoomMock,
  waitForRoomScreen,
  tapSeat,
  chainWolfVoteConfirm,
  chainSkipConfirm,
  chainConfirmTrigger,
  chainWolfRobotHunterStatus,
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

const BOARD_NAME = '机械狼通灵师12人';
const _board = getBoardByName(BOARD_NAME)!;

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

  describe('actionPrompt coverage', () => {
    it('wolfRobot learn: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
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

    it('psychic check: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'psychicCheck',
        currentActionRole: 'psychic',
        myRole: 'psychic',
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
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfRobot'],
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

  describe('wolfRobotHunterStatus coverage (CRITICAL: hunter gate)', () => {
    /**
     * CRITICAL TEST: WolfRobot learned hunter status gate
     *
     * When wolfRobot learns hunter, UI must show wolfRobotHunterStatus dialog
     * and require user to press primary button before proceeding.
     *
     * Prerequisites:
     * - wolfRobotReveal.learnedRoleId = 'hunter' (shows gate button)
     * - wolfRobotHunterStatusViewed = false (gate not yet cleared)
     * - Must press gate button ('查看发动状态') to trigger the dialog
     */
    it('wolfRobot learns hunter: shows hunter status gate, requires pressPrimary, no infinite loop', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false,
        },
        hookOverrides: {
          getWolfRobotHunterStatus: jest.fn().mockReturnValue({
            learned: true,
            viewed: false,
          }),
        },
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      // CRITICAL: Must press the gate button to trigger the dialog
      const hunterGateButton = getByText('查看发动状态');
      fireEvent.press(hunterGateButton);

      // Wait for hunter status gate to appear
      await waitFor(() => {
        expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true);
      });

      // CRITICAL: Must press primary button to clear gate
      harness.pressPrimary();

      // Verify no infinite loop (max 3 occurrences)
      harness.assertNoLoop({ type: 'wolfRobotHunterStatus', maxTimesPerStep: 3 });
    });

    /**
     * CRITICAL TEST: Verify sendWolfRobotHunterStatusViewed is called on confirmation
     *
     * This test ensures that pressing the primary button in the hunter status dialog
     * actually triggers the wire protocol message to the Host.
     */
    it('pressing confirm calls sendWolfRobotHunterStatusViewed', async () => {
      const sendWolfRobotHunterStatusViewedMock = jest.fn().mockResolvedValue(undefined);

      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false,
        },
        hookOverrides: {
          sendWolfRobotHunterStatusViewed: sendWolfRobotHunterStatusViewedMock,
        },
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      // Press gate button to trigger dialog
      const hunterGateButton = getByText('查看发动状态');
      fireEvent.press(hunterGateButton);

      await waitFor(() => {
        expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true);
      });

      // Press primary button (confirm)
      harness.pressPrimary();

      // CRITICAL ASSERTION: sendWolfRobotHunterStatusViewed must be called
      await waitFor(() => {
        expect(sendWolfRobotHunterStatusViewedMock).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * CRITICAL TEST: Gate button disappears after state update
     *
     * This test uses reactive mock with connect() to simulate the state update that occurs
     * after sendWolfRobotHunterStatusViewed succeeds. The button should disappear.
     *
     * NOTE: Uses createReactiveGameRoomMock with connect() for clean Host state simulation.
     */
    it('gate button disappears after wolfRobotHunterStatusViewed becomes true', async () => {
      // Initial state: gate not viewed - use reactive mock
      const reactiveMock = createReactiveGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false,
        },
      });
      mockUseGameRoomReturn = reactiveMock.getMock();

      const { getByTestId, getByText, queryByText, rerender } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      // Connect rerender for automatic updates when Host state changes
      reactiveMock.connect((newMock) => {
        mockUseGameRoomReturn = newMock;
        rerender(
          <RoomScreen
            route={{ params: { roomNumber: '1234', isHost: false } } as any}
            navigation={mockNavigation as any}
          />,
        );
      });

      await waitForRoomScreen(getByTestId);

      // Button should be visible initially
      expect(getByText('查看发动状态')).toBeTruthy();

      // Simulate state update: Host broadcasts wolfRobotHunterStatusViewed = true
      reactiveMock.simulateStateUpdate({
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: true, // Changed to true
        },
      });

      // CRITICAL ASSERTION: Button should disappear
      await waitFor(() => {
        expect(queryByText('查看发动状态')).toBeNull();
      });

      reactiveMock.disconnect();
    });

    /**
     * CRITICAL TEST: Cannot re-trigger hunter status dialog after gate cleared
     *
     * This test verifies that once wolfRobotHunterStatusViewed is true,
     * the hunter status dialog cannot be triggered again (prevents repeated learning).
     */
    it('cannot trigger hunter status dialog when wolfRobotHunterStatusViewed is true', async () => {
      // State with gate already cleared
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: true, // Gate already cleared
        },
      });

      const { getByTestId, queryByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      // Button should NOT be visible when gate is already cleared
      expect(queryByText('查看发动状态')).toBeNull();

      // Clear any prior dialog events
      harness.clear();

      // No wolfRobotHunterStatus dialog should appear automatically
      // (since there's no button to press and no auto-trigger)
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);
    });

    /**
     * CRITICAL TEST: Seat taps have NO effect after learning is complete
     *
     * Bug fix verification: After wolfRobot learns hunter (wolfRobotReveal exists),
     * tapping any seat should NOT trigger any action dialog or confirmation.
     * User must interact via bottom button only.
     */
    it('seat tap has no effect after learning is complete (cannot re-learn)', async () => {
      // State with learning complete (wolfRobotReveal exists)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false, // Gate not yet cleared
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

      // Try to tap a seat after learning is done
      tapSeat(getByTestId, 1);

      // Wait a bit to ensure no dialog appears
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CRITICAL: No action dialogs should appear from seat tap
      expect(harness.hasSeen('actionPrompt')).toBe(false);
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);

      // showAlert should NOT have been called for seat tap
      expect(showAlert).not.toHaveBeenCalled();
    });

    /**
     * CRITICAL TEST: Self-seat tap has NO effect after learning (Bug A fix)
     *
     * Bug fix verification: After wolfRobot learns (wolfRobotReveal exists),
     * tapping own seat should NOT trigger "不能选择自己" error dialog.
     * This tests that schema constraints are correctly skipped.
     */
    it('self-seat tap has no effect after learning (no "不能选择自己" error)', async () => {
      // State with learning complete (wolfRobotReveal exists)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false, // Gate not yet cleared
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

      // Try to tap own seat (mySeatNumber=7, 0-indexed)
      tapSeat(getByTestId, 7);

      // Wait a bit to ensure no dialog appears
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CRITICAL: No dialogs should appear, including "不能选择自己" error
      expect(harness.hasSeen('actionPrompt')).toBe(false);
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);

      // showAlert should NOT have been called for self-seat tap
      // This specifically tests that "不能选择自己" error is NOT shown
      expect(showAlert).not.toHaveBeenCalled();
    });

    /**
     * CRITICAL TEST: Prompt text changes when hunter gate is active (Bug B fix)
     *
     * Bug fix verification: After wolfRobot learns hunter and gate is active,
     * the prompt text above the bottom button should show hunter gate prompt,
     * NOT the learning prompt "请选择要学习的玩家".
     */
    it('prompt text shows hunter gate prompt when gate is active (not learning prompt)', async () => {
      // State with learning complete, hunter gate active
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false, // Gate not yet cleared
        },
      });

      const { getByTestId, queryByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      // CRITICAL: Should show hunter gate prompt, NOT learning prompt
      // The hunter gate prompt is: '请点击下方按钮查看猎人发动状态'
      // The learning prompt is: '请选择要学习的玩家'
      expect(queryByText(/请选择要学习的玩家/)).toBeNull();
      expect(queryByText(/请点击下方按钮查看猎人发动状态/)).not.toBeNull();
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
          killedIndex: -1, // No one died (use -1 as sentinel)
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

      // Tap a seat to trigger poison selection
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

  // =============================================================================
  // Chain Interaction (press button → assert callback)
  // =============================================================================

  describe('chain interaction', () => {
    const renderRoom = () =>
      render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );
    const setMock = (m: ReturnType<typeof createGameRoomMock>) => {
      mockUseGameRoomReturn = m;
    };

    it('wolfVote confirm → submitWolfVote called', async () => {
      await chainWolfVoteConfirm(
        harness, setMock, renderRoom,
        'wolf', 4,
        new Map<number, any>([[4, 'wolf'], [5, 'wolf'], [6, 'wolf'], [7, 'wolfRobot']]),
        1,
      );
    });

    it('skipConfirm (guard) → submitAction called', async () => {
      await chainSkipConfirm(
        harness, setMock, renderRoom,
        'guardProtect', 'guard', 'guard', 11,
      );
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(
        harness, setMock, renderRoom,
        'hunterConfirm', 'hunter', 'hunter', 10,
      );
    });

    it('wolfRobotHunterStatus → sendWolfRobotHunterStatusViewed called', async () => {
      await chainWolfRobotHunterStatus(
        harness, setMock, renderRoom,
        7,
      );
    });
  });

  // =============================================================================
  // Coverage Assertion (MUST PASS)
  // =============================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    /**
     * Final coverage assertion for wolfRobot board.
     * Accumulates all dialog events and verifies all required UI types were seen.
     */
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (wolfRobot learn)
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
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

      // Step 2: wolfVote
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfRobot'],
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

      // Note: wolfRobotHunterStatus MUST be tested with real interaction
      // Step 3: wolfRobotHunterStatus (wolfRobot learns hunter)
      // Must set wolfRobotReveal.learnedRoleId = 'hunter' AND wolfRobotHunterStatusViewed = false
      // Then press the gate button to trigger the dialog
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfRobotLearn',
        currentActionRole: 'wolfRobot',
        myRole: 'wolfRobot',
        mySeatNumber: 7,
        gameStateOverrides: {
          wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
          wolfRobotHunterStatusViewed: false,
        },
        hookOverrides: {
          getWolfRobotHunterStatus: jest.fn().mockReturnValue({
            learned: true,
            viewed: false,
          }),
        },
      });

      result = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(result.getByTestId);
      // CRITICAL: Must press the gate button to trigger wolfRobotHunterStatus dialog
      // The button text is schema-driven: hunterGateButtonText = '查看发动状态'
      const hunterGateButton = result.getByText('查看发动状态');
      fireEvent.press(hunterGateButton);
      await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));
      harness.pressPrimary(); // Clear the gate
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

      // Step 6: witchPoisonPrompt
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: {
          killedIndex: -1, // No one died (use -1 as sentinel)
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

      // Step 7: confirmTrigger (hunter) - MUST press the confirm button
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

      // Step 8: skipConfirm (guard) - MUST press the skip button
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
        'wolfRobotHunterStatus',
        'witchSavePrompt',
        'witchPoisonPrompt',
        'confirmTrigger',
        'skipConfirm',
      ]);
    });
  });
});

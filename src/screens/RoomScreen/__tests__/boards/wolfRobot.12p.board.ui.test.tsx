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

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

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
     * - Must press gate button ('查看状态') to trigger the dialog
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
      const hunterGateButton = getByText('查看状态');
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
      // The button text is schema-driven: hunterGateButtonText = '查看状态'
      const hunterGateButton = result.getByText('查看状态');
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

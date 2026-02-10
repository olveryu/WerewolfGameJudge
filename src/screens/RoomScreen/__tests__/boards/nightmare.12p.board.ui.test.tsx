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

import { fireEvent,render, waitFor } from '@testing-library/react-native';

import { BLOCKED_UI_DEFAULTS, getSchema } from '@/models/roles/spec';
import {
  boardHasNightmare,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfVoteConfirm,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainNightmareBlocked,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createGameRoomMock,
  createReactiveGameRoomMock,
  createShowAlertMock,
  getBoardByName,
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

// Use MockSafeAreaView from harness to preserve testID
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
     *
     * NOTE: Uses createReactiveGameRoomMock with connect() for clean state simulation.
     */
    it('blocked seer: tapSeat triggers action → Host rejects → shows actionRejected with BLOCKED_UI_DEFAULTS', async () => {
      // Seer is blocked by nightmare - use reactive mock
      const reactiveMock = createReactiveGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
        nightmareBlockedSeat: 8,
        currentNightResults: {
          blockedSeat: 8,
        },
      });
      mockUseGameRoomReturn = reactiveMock.getMock();

      const { getByTestId, rerender } = render(
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
      harness.clear();

      // REAL INTERACTION: Blocked seer taps a seat to try to act
      tapSeat(getByTestId, 1);

      // Simulate Host rejecting the action due to nightmare block
      // Uses reactive mock - connect() auto-triggers rerender
      reactiveMock.simulateHostReject({
        action: 'seerCheck',
        reason: BLOCKED_UI_DEFAULTS.message,
        targetUid: 'p8',
        rejectionId: 'nightmare-block-1',
      });

      // actionRejected is triggered via useEffect when gameState.actionRejected changes
      await waitFor(() => {
        expect(harness.hasSeen('actionRejected')).toBe(true);
      });

      // Verify the rejection message matches BLOCKED_UI_DEFAULTS
      const rejectedEvents = harness.eventsOfType('actionRejected');
      expect(rejectedEvents.length).toBeGreaterThan(0);
      expect(rejectedEvents[0].message).toContain(BLOCKED_UI_DEFAULTS.message);

      reactiveMock.disconnect();
    });

    it('blocked witch: tapSeat triggers action → Host rejects → shows actionRejected', async () => {
      // Witch is blocked by nightmare - use reactive mock
      const reactiveMock = createReactiveGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        nightmareBlockedSeat: 9,
        currentNightResults: {
          blockedSeat: 9,
        },
        witchContext: {
          killedSeat: 1,
          canSave: true,
          canPoison: true,
        },
      });
      mockUseGameRoomReturn = reactiveMock.getMock();

      const { getByTestId, rerender } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      // Connect rerender for automatic updates
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
      harness.clear();

      // REAL INTERACTION: Blocked witch taps to try to use poison
      tapSeat(getByTestId, 1);

      // Host rejects due to nightmare block - uses reactive mock
      reactiveMock.simulateHostReject({
        action: 'witchAction',
        reason: BLOCKED_UI_DEFAULTS.message,
        targetUid: 'p9',
        rejectionId: 'nightmare-block-2',
      });

      await waitFor(() => {
        expect(harness.hasSeen('actionRejected')).toBe(true);
      });

      reactiveMock.disconnect();
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
          killedSeat: 1,
          canSave: true,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedSeat: 1,
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
          killedSeat: -1, // No one died
          canSave: false,
          canPoison: true,
        },
        gameStateOverrides: {
          witchContext: {
            killedSeat: -1,
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
        expect(harness.hasSeen('witchPoisonPrompt')).toBe(true);
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
        gameStateOverrides: {
          confirmStatus: { role: 'hunter', canShoot: true },
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
        expect(harness.hasSeen('actionPrompt')).toBe(true);
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
      const skipText = getSchema('guardProtect').ui?.bottomActionText;
      if (!skipText) {
        throw new Error('[TEST] Missing guardProtect.ui.bottomActionText');
      }

      const skipButton = getByText(skipText);
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
        wolfKillDisabled: true,
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

  describe('seer actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
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
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
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

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      const emptyText = getSchema('wolfKill').ui?.emptyVoteText;
      if (!emptyText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');
      fireEvent.press(getByText(emptyText));
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  // =============================================================================
  // Chain Interaction (press button → assert callback)
  // =============================================================================

  describe('chain interaction', () => {
    it('wolfVote confirm → submitWolfVote called', async () => {
      await chainWolfVoteConfirm(
        harness,
        setMock,
        renderRoom,
        'nightmare',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
        1,
      );
    });

    it('skipConfirm (guard) → submitAction called', async () => {
      await chainSkipConfirm(harness, setMock, renderRoom, 'guardProtect', 'guard', 'guard', 11);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'hunterConfirm',
        'hunter',
        'hunter',
        10,
      );
    });
  });

  // =============================================================================
  // Coverage Assertion (MUST PASS)
  // =============================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    /**
     * Final coverage assertion for nightmare board.
     * Uses coverage chain helpers for real button presses + effect assertions.
     * Events accumulate across chains for final assertCoverage().
     */
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (nightmare block selection)
      await coverageChainActionPrompt(
        harness,
        setMock,
        renderRoom,
        'nightmareBlock',
        'nightmare',
        'nightmare',
        7,
      );

      // Step 2: wolfVote (nightmare wolf voting) → confirm → submitWolfVote called
      const { submitWolfVote } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'nightmare',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
        1,
      );
      expect(submitWolfVote).toHaveBeenCalledTimes(1);

      // Step 3: actionRejected (blocked seer with REAL interaction)
      // CRITICAL: parameter-level assertion on rejectedEvents message (prevent identity drift)
      const { rejectedEvents } = await coverageChainNightmareBlocked(
        harness,
        setMock,
        renderRoom,
        'seerCheck',
        'seer',
        8,
        BLOCKED_UI_DEFAULTS.message,
      );
      expect(rejectedEvents.length).toBeGreaterThan(0);
      expect(rejectedEvents[0].message).toContain(BLOCKED_UI_DEFAULTS.message);

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 5: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Step 6: confirmTrigger (hunter) → confirm button pressed → assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'hunterConfirm',
        'hunter',
        'hunter',
        10,
      );

      // Step 7: skipConfirm (guard) → skip button pressed → submitAction called
      const { submitAction } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'guardProtect',
        'guard',
        'guard',
        11,
      );
      expect(submitAction).toHaveBeenCalledTimes(1);

      // Step 8: actionConfirm (seer tap seat) → press confirm → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatActionConfirm(
        harness,
        setMock,
        renderRoom,
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 9: wolfVoteEmpty → press confirm → submitWolfVote(-1) called
      const { submitWolfVote: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'nightmare',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'nightmare'],
        ]),
      );
      expect(emptyVote).toHaveBeenCalledWith(-1);

      // Use literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'actionRejected',
        'witchSavePrompt',
        'witchNoKill',
        'witchPoisonPrompt',
        'actionConfirm',
        'confirmTrigger',
        'skipConfirm',
      ]);
    });
  });
});

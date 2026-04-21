/**
 * TreasureMaster 12P Board UI Test
 *
 * Board: 盗宝大师
 * Roles: 5x villager, 3x wolf, darkWolfKing, psychic, poisoner, hunter,
 *        dreamcatcher, crow, treasureMaster (15 roles → 12 players + 3 bottom cards)
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: psychic, dreamcatcher actions
 * - wolfVote: wolf vote dialog
 * - wolfVoteEmpty: wolf empty knife
 * - actionConfirm: psychic/dreamcatcher seat tap confirm
 * - skipConfirm: psychic/dreamcatcher skip
 * - confirmTrigger: hunter/darkWolfKing confirm trigger
 *
 * Server-data required (covered by integration):
 * - psychicReveal
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { getSchema } from '@werewolf/game-engine/models/roles/spec';

import {
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfVoteConfirm,
  // Coverage-integrated chain drivers
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createGameRoomMock,
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
  ...jest.requireActual('../../../../utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
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

const BOARD_NAME = '盗宝大师';
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
  const renderRoom = () =>
    render(
      <RoomScreen
        route={{ params: { roomCode: '1234', isHost: false } } as any}
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

  describe('actionPrompt coverage', () => {
    it('psychic action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'psychicCheck',
        currentActionRole: 'psychic',
        myRole: 'psychic',
        mySeat: 10,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('darkWolfKing vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'darkWolfKing',
        mySeat: 9,
        roleAssignments: new Map([
          [6, 'wolf'],
          [7, 'wolf'],
          [8, 'wolf'],
          [9, 'darkWolfKing'],
        ]),
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'darkWolfKingConfirm',
        currentActionRole: 'darkWolfKing',
        myRole: 'darkWolfKing',
        mySeat: 9,
        gameStateOverrides: { confirmStatus: { role: 'darkWolfKing', canShoot: true } },
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      const bottomActionText = getSchema('darkWolfKingConfirm').ui?.bottomActionText;
      if (!bottomActionText)
        throw new Error('[TEST] Missing darkWolfKingConfirm.ui.bottomActionText');

      await waitFor(() => expect(getByText(bottomActionText)).toBeTruthy());
      fireEvent.press(getByText(bottomActionText));

      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });

    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeat: 12,
        gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);

      const bottomActionText = getSchema('hunterConfirm').ui?.bottomActionText;
      if (!bottomActionText) throw new Error('[TEST] Missing hunterConfirm.ui.bottomActionText');

      await waitFor(() => expect(getByText(bottomActionText)).toBeTruthy());
      fireEvent.press(getByText(bottomActionText));

      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('psychic actionConfirm coverage', () => {
    it('psychic: seat tap shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'psychicCheck',
        currentActionRole: 'psychic',
        myRole: 'psychic',
        mySeat: 10,
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('psychic skipConfirm coverage', () => {
    it('psychic: skip button shows skipConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'psychicCheck',
        currentActionRole: 'psychic',
        myRole: 'psychic',
        mySeat: 10,
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('psychicCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing psychicCheck.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'darkWolfKing',
        mySeat: 9,
        roleAssignments: new Map([
          [6, 'wolf'],
          [7, 'wolf'],
          [8, 'wolf'],
          [9, 'darkWolfKing'],
        ]),
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomCode: '1234', isHost: false } } as any}
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
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        9,
        new Map<number, any>([
          [6, 'wolf'],
          [7, 'wolf'],
          [8, 'wolf'],
          [9, 'darkWolfKing'],
        ]),
        1,
      );
    });

    it('skipConfirm (psychic) → submitAction called', async () => {
      await chainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
      );
    });

    it('confirmTrigger (darkWolfKing) → dialog dismissed', async () => {
      await chainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        9,
      );
    });
  });

  // =============================================================================
  // Coverage Assertion (MUST PASS)
  // =============================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (psychic)
      await coverageChainActionPrompt(
        harness,
        setMock,
        renderRoom,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
      );

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        9,
        new Map<number, any>([
          [6, 'wolf'],
          [7, 'wolf'],
          [8, 'wolf'],
          [9, 'darkWolfKing'],
        ]),
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith(1);

      // Step 3: confirmTrigger (darkWolfKing) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        9,
      );

      // Step 4: actionConfirm (psychic tap seat) → press confirm → submitAction called
      const { submitAction: psychicSubmit } = await coverageChainSeatActionConfirm(
        harness,
        setMock,
        renderRoom,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
        1,
      );
      expect(psychicSubmit).toHaveBeenCalled();

      // Step 5: skipConfirm (psychic) → press primary → submitAction called
      const { submitAction: psychicSkip } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
      );
      expect(psychicSkip).toHaveBeenCalled();

      // Step 6: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        9,
        new Map<number, any>([
          [6, 'wolf'],
          [7, 'wolf'],
          [8, 'wolf'],
          [9, 'darkWolfKing'],
        ]),
      );
      expect(emptyVote).toHaveBeenCalledWith(null);

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'actionConfirm',
        'skipConfirm',
        'confirmTrigger',
      ]);
    });
  });
});

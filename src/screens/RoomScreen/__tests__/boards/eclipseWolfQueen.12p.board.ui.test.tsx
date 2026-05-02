/**
 * EclipseWolfQueen 12P Board UI Test
 *
 * Board: 永序之轮
 * Roles: 4x villager, 3x wolf, eclipseWolfQueen, seer, witch, guard, sequencePrince
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, wolfVoteEmpty,
 *   witchSavePrompt, witchPoisonPrompt, witchNoKill, actionConfirm, skipConfirm
 *
 * Note: sequencePrince has no night-1 action (triggered ability)
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getSchema } from '@werewolf/game-engine/models/roles/spec';

import {
  chainWolfVoteConfirm,
  coverageChainActionPrompt,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createGameRoomMock,
  createShowAlertMock,
  getBoardByName,
  mockNavigation,
  mockRoomRoute,
  RoomScreenTestHarness,
  tapSeat,
  waitForRoomScreen,
} from '@/screens/RoomScreen/__tests__/harness';
import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { showAlert } from '@/utils/alert';

jest.mock('../../../../utils/alert', () => ({
  ...jest.requireActual<typeof import('../../../../utils/alert')>('../../../../utils/alert'),
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

const BOARD_NAME = '永序之轮';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

describe(`RoomScreen UI: ${BOARD_NAME}`, () => {
  const renderRoom = () => render(<RoomScreen route={mockRoomRoute} navigation={mockNavigation} />);
  const setMock = (m: ReturnType<typeof createGameRoomMock>) => {
    mockUseGameRoomReturn = m;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  describe('actionPrompt coverage', () => {
    it('eclipseWolfQueen action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'eclipseWolfQueenShelter',
        currentActionRole: 'eclipseWolfQueen',
        myRole: 'eclipseWolfQueen',
        mySeat: 7,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('eclipseWolfQueen vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'eclipseWolfQueen',
        mySeat: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'eclipseWolfQueen'],
        ]),
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('eclipseWolfQueenShelter actionConfirm coverage', () => {
    it('eclipseWolfQueen: tapping seat shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'eclipseWolfQueenShelter',
        currentActionRole: 'eclipseWolfQueen',
        myRole: 'eclipseWolfQueen',
        mySeat: 7,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('eclipseWolfQueenShelter skipConfirm coverage', () => {
    it('eclipseWolfQueen: skip button shows skipConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'eclipseWolfQueenShelter',
        currentActionRole: 'eclipseWolfQueen',
        myRole: 'eclipseWolfQueen',
        mySeat: 7,
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('eclipseWolfQueenShelter').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing eclipseWolfQueenShelter.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'eclipseWolfQueen',
        mySeat: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'eclipseWolfQueen'],
        ]),
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const emptyText = getSchema('wolfKill').ui?.emptyVoteText;
      if (!emptyText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');
      fireEvent.press(getByText(emptyText));
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  describe('chain interaction', () => {
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueen',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'eclipseWolfQueen'],
        ]),
        1,
      );
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (eclipseWolfQueen)
      await coverageChainActionPrompt(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
      );

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueen',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'eclipseWolfQueen'],
        ]),
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith(1);

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Step 5: actionConfirm (eclipseWolfQueen tap seat)
      const { submitAction: shelterSubmit } = await coverageChainSeatActionConfirm(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
        1,
      );
      expect(shelterSubmit).toHaveBeenCalled();

      // Step 6: skipConfirm (eclipseWolfQueen)
      const { submitAction: shelterSkip } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
      );
      expect(shelterSkip).toHaveBeenCalled();

      // Step 7: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'eclipseWolfQueen',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'eclipseWolfQueen'],
        ]),
      );
      expect(emptyVote).toHaveBeenCalledWith(null);

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'witchSavePrompt',
        'witchNoKill',
        'witchPoisonPrompt',
        'actionConfirm',
        'skipConfirm',
      ]);
    });
  });
});

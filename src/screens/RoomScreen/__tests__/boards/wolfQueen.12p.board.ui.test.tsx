/**
 * WolfQueen 12P Board UI Test
 *
 * Board: 狼美守卫12人
 * Roles: 4x villager, 3x wolf, wolfQueen, seer, witch, hunter, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm
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
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
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

const BOARD_NAME = '狼美守卫12人';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseGameRoomReturn: ReturnType<typeof createGameRoomMock>;

jest.mock('../../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomReturn,
}));

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

  describe('actionPrompt coverage', () => {
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
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolfQueen',
        mySeatNumber: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfQueen'],
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
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
      });

      const { getByTestId } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

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
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'hunterConfirm',
        currentActionRole: 'hunter',
        myRole: 'hunter',
        mySeatNumber: 10,
        gameStateOverrides: { confirmStatus: { role: 'hunter', canShoot: true } },
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
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

  // ===========================================================================
  // Role-specific schema: wolfQueenCharm (not proxied through seer)
  // ===========================================================================

  describe('wolfQueenCharm actionPrompt coverage', () => {
    it('wolfQueen charm: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfQueenCharm',
        currentActionRole: 'wolfQueen',
        myRole: 'wolfQueen',
        mySeatNumber: 7,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfQueenCharm actionConfirm coverage', () => {
    it('wolfQueen charm: tapping seat shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfQueenCharm',
        currentActionRole: 'wolfQueen',
        myRole: 'wolfQueen',
        mySeatNumber: 7,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('wolfQueenCharm skipConfirm coverage', () => {
    it('wolfQueen charm: skip button shows skipConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfQueenCharm',
        currentActionRole: 'wolfQueen',
        myRole: 'wolfQueen',
        mySeatNumber: 7,
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('wolfQueenCharm').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing wolfQueenCharm.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
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
        myRole: 'wolfQueen',
        mySeatNumber: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfQueen'],
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
        'wolfQueen',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfQueen'],
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

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, setMock, renderRoom, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolfVote → press confirm → submitWolfVote(1) called
      const { submitWolfVote } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'wolfQueen',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfQueen'],
        ]),
        1,
      );
      expect(submitWolfVote).toHaveBeenCalledWith(1);

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Step 5: skipConfirm (guard) → press primary → submitAction called
      const { submitAction: guardSubmit } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'guardProtect',
        'guard',
        'guard',
        11,
      );
      expect(guardSubmit).toHaveBeenCalled();

      // Step 6: confirmTrigger (hunter) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'hunterConfirm',
        'hunter',
        'hunter',
        10,
      );

      // Step 7: actionConfirm (seer tap seat) → press confirm → submitAction called
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

      // Step 8: wolfVoteEmpty → press confirm → submitWolfVote(-1) called
      const { submitWolfVote: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'wolfQueen',
        7,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolfQueen'],
        ]),
      );
      expect(emptyVote).toHaveBeenCalledWith(-1);

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
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

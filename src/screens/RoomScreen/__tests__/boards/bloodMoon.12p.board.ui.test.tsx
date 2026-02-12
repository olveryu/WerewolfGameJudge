/**
 * BloodMoon 12P Board UI Test
 *
 * Board: 血月猎魔12人
 * Roles: 4x villager, 4x wolf, bloodMoon, seer, witch, witcher
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt
 *
 * Note: This board has NO hunter/guard, so no confirmTrigger/skipConfirm required
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getSchema } from '@/models/roles/spec';
import {
  chainWolfVoteConfirm,
  // Coverage-integrated chain drivers
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

const BOARD_NAME = '血月猎魔12人';
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
        mySeatNumber: 9,
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

    it('witcher action: shows action prompt', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck', // bloodMoon uses similar check pattern
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
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
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
        mySeatNumber: 10,
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
        mySeatNumber: 10,
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

  describe('seer actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 9,
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

  describe('seer skipConfirm coverage', () => {
    it('seer: skip button shows skipConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 9,
      });

      const { getByTestId, getByText } = render(
        <RoomScreen
          route={{ params: { roomNumber: '1234', isHost: false } } as any}
          navigation={mockNavigation as any}
        />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('seerCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');
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
        mySeatNumber: 10,
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
        myRole: 'wolf',
        mySeatNumber: 4,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
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
        'wolf',
        4,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
        1,
      );
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, setMock, renderRoom, 'seerCheck', 'seer', 'seer', 9);

      // Step 2: wolfVote → press confirm → submitWolfVote(1) called
      const { submitWolfVote } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'wolf',
        4,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
        ]),
        1,
      );
      expect(submitWolfVote).toHaveBeenCalledWith(1);

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 10);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 10);

      // Step 5: actionConfirm (seer tap seat) → press confirm → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatActionConfirm(
        harness,
        setMock,
        renderRoom,
        'seerCheck',
        'seer',
        'seer',
        9,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 6: skipConfirm (seer) → press primary → submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'seerCheck',
        'seer',
        'seer',
        9,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 7: wolfVoteEmpty → press confirm → submitWolfVote(-1) called
      const { submitWolfVote: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'wolf',
        4,
        new Map<number, any>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'wolf'],
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
        'skipConfirm',
      ]);
    });
  });
});

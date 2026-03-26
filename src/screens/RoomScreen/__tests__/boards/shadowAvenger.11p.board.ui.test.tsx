/**
 * Shadow + Avenger 12P Board UI Test
 *
 * Board: 影仇混标准
 * Roles: 3x villager, 3x wolf, shadow, avenger, slacker, seer, witch, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: seer, witch, shadow, guard actions
 * - wolfVote: wolf vote dialog
 * - witchSavePrompt: witch save flow
 * - witchPoisonPrompt: witch poison flow
 * - confirmTrigger: avenger confirm trigger
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { getSchema, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import { Team } from '@werewolf/game-engine/models/roles/spec/types';

import {
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

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../../../utils/alert', () => ({
  ...jest.requireActual('../../../../utils/alert'),
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

const BOARD_NAME = '影仇混标准';
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

      const { getByTestId } = renderRoom();
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
        mySeatNumber: 2,
        roleAssignments: new Map([
          [2, 'wolf'],
          [3, 'wolf'],
          [4, 'wolf'],
        ]),
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(harness.hasSeen('wolfVote')).toBe(true);
      });
    });

    it('wolf vote: empty target shows wolfVoteEmpty dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'wolf',
        mySeatNumber: 2,
        roleAssignments: new Map([
          [2, 'wolf'],
          [3, 'wolf'],
          [4, 'wolf'],
        ]),
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const emptyVoteText = SCHEMAS.wolfKill.ui?.emptyVoteText;
      if (!emptyVoteText) throw new Error('[TEST] Missing wolfKill.ui.emptyVoteText');
      fireEvent.press(getByText(emptyVoteText));

      await waitFor(() => {
        expect(harness.hasSeen('wolfVoteEmpty')).toBe(true);
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
        witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        gameStateOverrides: {
          witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        },
      });

      const { getByTestId } = renderRoom();
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
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: {
          witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      tapSeat(getByTestId, 1);

      await waitFor(() => {
        expect(harness.hasSeen('witchPoisonPrompt')).toBe(true);
      });
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch action: shows no-kill info when nobody died', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeatNumber: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: {
          witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        },
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);

      await waitFor(() => {
        expect(harness.hasSeen('witchNoKill')).toBe(true);
      });
    });
  });

  describe('confirmTrigger coverage (avenger)', () => {
    it('avenger confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'avengerConfirm',
        currentActionRole: 'avenger',
        myRole: 'avenger',
        mySeatNumber: 1,
        gameStateOverrides: {
          confirmStatus: { role: 'avenger', faction: Team.Good },
        },
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);

      const bottomActionText = getSchema('avengerConfirm').ui?.bottomActionText;
      if (!bottomActionText) throw new Error('[TEST] Missing avengerConfirm.ui.bottomActionText');

      await waitFor(() => expect(getByText(bottomActionText)).toBeTruthy());
      fireEvent.press(getByText(bottomActionText));

      await waitFor(() => {
        expect(harness.hasSeen('confirmTrigger')).toBe(true);
      });
    });
  });

  describe('shadow actionConfirm coverage', () => {
    it('shadow: seat tap shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'shadowChooseMimic',
        currentActionRole: 'shadow',
        myRole: 'shadow',
        mySeatNumber: 0,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('seer actionConfirm coverage', () => {
    it('seer: seat tap shows actionConfirm dialog', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeatNumber: 8,
      });

      const { getByTestId } = renderRoom();
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
        mySeatNumber: 8,
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const bottomActionText = getSchema('seerCheck').ui?.bottomActionText;
      if (!bottomActionText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');
      fireEvent.press(getByText(bottomActionText));

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('guard actionConfirm + skipConfirm coverage', () => {
    it('guard: seat tap shows actionConfirm', async () => {
      mockUseGameRoomReturn = createGameRoomMock({
        schemaId: 'guardProtect',
        currentActionRole: 'guard',
        myRole: 'guard',
        mySeatNumber: 10,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, setMock, renderRoom, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'wolf',
        2,
        new Map<number, any>([
          [2, 'wolf'],
          [3, 'wolf'],
          [4, 'wolf'],
        ]),
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith(1);

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Step 5: confirmTrigger (avenger)
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'avengerConfirm',
        'avenger',
        'avenger',
        1,
      );

      // Step 6: actionConfirm (shadow tap seat)
      const { submitAction: shadowSubmit } = await coverageChainSeatActionConfirm(
        harness,
        setMock,
        renderRoom,
        'shadowChooseMimic',
        'shadow',
        'shadow',
        0,
        1,
      );
      expect(shadowSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (seer)
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        setMock,
        renderRoom,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'wolf',
        2,
        new Map<number, any>([
          [2, 'wolf'],
          [3, 'wolf'],
          [4, 'wolf'],
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
        'confirmTrigger',
      ]);
    });
  });
});

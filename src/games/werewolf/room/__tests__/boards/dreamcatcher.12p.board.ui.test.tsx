/**
 * Dreamcatcher 12P Board UI Test
 *
 * Board: Wolf King Dreamcatcher
 * Roles: 4x villager, 3x wolf, darkWolfKing, seer, witch, hunter, dreamcatcher
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getSchema } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  chainConfirmTrigger,
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
  createShowAlertMock,
  createWerewolfRoomMock,
  getBoardByName,
  mockNavigation,
  mockRoom,
  RoomScreenTestHarness,
  tapSeat,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';
import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('../../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

jest.mock('../../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: true,
  }),
}));

const BOARD_NAME = '狼王摄梦人';
const _board = getBoardByName(BOARD_NAME)!;

let harness: RoomScreenTestHarness;
let mockUseWerewolfRoomReturn: ReturnType<typeof createWerewolfRoomMock>;

jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseWerewolfRoomReturn,
}));

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  const renderRoom = () =>
    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);
  const setMock = (m: ReturnType<typeof createWerewolfRoomMock>) => {
    mockUseWerewolfRoomReturn = m;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  describe('actionPrompt coverage', () => {
    it('dreamcatcher action: shows action prompt', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'dreamcatcherDream',
        currentActionRole: 'dreamcatcher',
        myRole: 'dreamcatcher',
        mySeat: 11,
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('darkWolfKing vote: tapping seat shows wolf vote dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'darkWolfKing',
        mySeat: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'darkWolfKingConfirm',
        currentActionRole: 'darkWolfKing',
        myRole: 'darkWolfKing',
        mySeat: 7,
        gameStateOverrides: { confirmStatus: { role: 'darkWolfKing', canShoot: true } },
      });

      const { getByTestId, getByText } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);

      const bottomActionText = getSchema('darkWolfKingConfirm').ui?.bottomActionText;
      if (!bottomActionText)
        throw new Error('[TEST] Missing darkWolfKingConfirm.ui.bottomActionText');

      await waitFor(() => expect(getByText(bottomActionText)).toBeTruthy());
      fireEvent.press(getByText(bottomActionText));

      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: 1, canSave: true, canPoison: true } },
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('seer actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeat: 8,
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('seer skipConfirm coverage', () => {
    it('seer: skip button shows skipConfirm dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeat: 8,
      });

      const { getByTestId, getByText } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('seerCheck').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing seerCheck.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  // ===========================================================================
  // Role-specific schema: dreamcatcherDream (not proxied through seer)
  // ===========================================================================

  describe('dreamcatcherDream actionConfirm coverage', () => {
    it('dreamcatcher: tapping seat shows actionConfirm dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'dreamcatcherDream',
        currentActionRole: 'dreamcatcher',
        myRole: 'dreamcatcher',
        mySeat: 11,
      });

      const { getByTestId } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();
      tapSeat(getByTestId, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('dreamcatcherDream skipConfirm coverage', () => {
    it('dreamcatcher: skip button shows skipConfirm dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'dreamcatcherDream',
        currentActionRole: 'dreamcatcher',
        myRole: 'dreamcatcher',
        mySeat: 11,
      });

      const { getByTestId, getByText } = renderRoom();
      await waitForRoomScreen(getByTestId);
      harness.clear();

      const skipText = getSchema('dreamcatcherDream').ui?.bottomActionText;
      if (!skipText) throw new Error('[TEST] Missing dreamcatcherDream.ui.bottomActionText');
      fireEvent.press(getByText(skipText));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'witchAction',
        currentActionRole: 'witch',
        myRole: 'witch',
        mySeat: 9,
        witchContext: { killedSeat: -1, canSave: false, canPoison: true },
        gameStateOverrides: { witchContext: { killedSeat: -1, canSave: false, canPoison: true } },
      });

      const { getByTestId } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
      );

      await waitForRoomScreen(getByTestId);
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      mockUseWerewolfRoomReturn = createWerewolfRoomMock({
        schemaId: 'wolfKill',
        currentActionRole: 'wolf',
        myRole: 'darkWolfKing',
        mySeat: 7,
        roleAssignments: new Map([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
      });

      const { getByTestId, getByText } = render(
        <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
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
  // Chain Interaction (press button -> assert callback)
  // =============================================================================

  describe('chain interaction', () => {
    it('wolfVote confirm -> submitAction called', async () => {
      await chainWolfVoteConfirm(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
        1,
      );
    });

    it('confirmTrigger (darkWolfKing) -> dialog dismissed', async () => {
      await chainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (dreamcatcher)
      await coverageChainActionPrompt(
        harness,
        setMock,
        renderRoom,
        'dreamcatcherDream',
        'dreamcatcher',
        'dreamcatcher',
        11,
      );

      // Step 2: wolfVote -> press confirm -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (darkWolfKing) -> press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        setMock,
        renderRoom,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);

      // Step 5: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

      // Step 6: actionConfirm (seer tap seat) -> press confirm -> submitAction called
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

      // Step 7: skipConfirm (seer) -> press primary -> submitAction called
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

      // Step 8: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        setMock,
        renderRoom,
        'darkWolfKing',
        7,
        new Map<number, RoleId>([
          [4, 'wolf'],
          [5, 'wolf'],
          [6, 'wolf'],
          [7, 'darkWolfKing'],
        ]),
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'confirmTrigger',
        'witchSavePrompt',
        'witchNoKill',
        'witchPoisonPrompt',
        'actionConfirm',
        'skipConfirm',
      ]);
    });
  });
});

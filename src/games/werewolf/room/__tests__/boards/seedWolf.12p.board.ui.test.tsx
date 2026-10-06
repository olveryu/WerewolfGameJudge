/**
 * Seed Wolf 12P Board UI Test
 *
 * Board: Seed Wolf+Knight
 * Roles: 4x villager, 3x wolf, seedWolf, seer, witch, knight, guard
 *
 * Covers the authoritative infection target prompt, optional skip, and final
 * personal infection result acknowledgement in addition to shared board flows.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { getSchema } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  coverageChainActionPrompt,
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
  successfulWerewolfCommand,
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

const board = getBoardByName('种狼骑士');
if (!board) throw new Error('[TEST] Missing 种狼骑士 preset');

let harness: RoomScreenTestHarness;
let mockUseWerewolfRoomReturn: ReturnType<typeof createWerewolfRoomMock>;

jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseWerewolfRoomReturn,
}));

describe(`WerewolfRoomScreen UI: ${board.name}`, () => {
  const renderRoom = () =>
    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);
  const setMock = (mock: ReturnType<typeof createWerewolfRoomMock>) => {
    mockUseWerewolfRoomReturn = mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  it('covers board dialogs, infection choice, skip, and final acknowledgement', async () => {
    await coverageChainActionPrompt(
      harness,
      setMock,
      renderRoom,
      'seedWolfInfect',
      'seedWolf',
      'seedWolf',
      7,
    );

    const wolfAssignments = new Map<number, RoleId>([
      [4, 'wolf'],
      [5, 'wolf'],
      [6, 'wolf'],
      [7, 'seedWolf'],
    ]);
    const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
      harness,
      setMock,
      renderRoom,
      'wolf',
      4,
      wolfAssignments,
      1,
    );
    expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

    await coverageChainWitchSavePrompt(harness, setMock, renderRoom, 9);
    await coverageChainWitchPoisonPrompt(harness, setMock, renderRoom, 9);

    const { submitAction: seerAction } = await coverageChainSeatActionConfirm(
      harness,
      setMock,
      renderRoom,
      'seerCheck',
      'seer',
      'seer',
      8,
      1,
    );
    expect(seerAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

    const { submitAction: seerSkipAction } = await coverageChainSkipConfirm(
      harness,
      setMock,
      renderRoom,
      'seerCheck',
      'seer',
      'seer',
      8,
    );
    expect(seerSkipAction).toHaveBeenCalledWith({ kind: 'skip' });

    const { submitAction: emptyVoteAction } = await coverageChainWolfVoteEmpty(
      harness,
      setMock,
      renderRoom,
      'wolf',
      4,
      wolfAssignments,
    );
    expect(emptyVoteAction).toHaveBeenCalledWith({ kind: 'target', target: null });

    const infectionAction = jest.fn().mockResolvedValue(successfulWerewolfCommand());
    setMock(
      createWerewolfRoomMock({
        schemaId: 'seedWolfInfect',
        currentActionRole: 'seedWolf',
        myRole: 'seedWolf',
        mySeat: 7,
        gameStateOverrides: {
          confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 1 },
        },
        hookOverrides: { submitAction: infectionAction },
      }),
    );
    const infectionScreen = renderRoom();
    await waitForRoomScreen(infectionScreen.getByTestId);
    fireEvent.press(infectionScreen.getByText('感染'));
    await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    expect(harness.getLastEventOfType('confirmTrigger')?.message).toContain('2号');
    harness.pressPrimaryOnType('confirmTrigger');
    await waitFor(() => expect(infectionAction).toHaveBeenCalledWith({ kind: 'confirm' }));
    infectionScreen.unmount();

    const skipInfectionAction = jest.fn().mockResolvedValue(successfulWerewolfCommand());
    setMock(
      createWerewolfRoomMock({
        schemaId: 'seedWolfInfect',
        currentActionRole: 'seedWolf',
        myRole: 'seedWolf',
        mySeat: 7,
        gameStateOverrides: {
          confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 1 },
        },
        hookOverrides: { submitAction: skipInfectionAction },
      }),
    );
    const skipScreen = renderRoom();
    await waitForRoomScreen(skipScreen.getByTestId);
    expect(skipScreen.queryByText('不用技能')).toBeNull();
    fireEvent.press(skipScreen.getByText('感染'));
    await waitFor(() =>
      expect(harness.getLastEventOfType('confirmTrigger')?.buttons).toEqual(['不用技能', '感染']),
    );
    harness.pressButtonOnType('confirmTrigger', '不用技能');
    await waitFor(() => expect(skipInfectionAction).toHaveBeenCalledWith({ kind: 'skip' }));
    skipScreen.unmount();

    const submitGroupConfirmAck = jest.fn().mockResolvedValue(successfulWerewolfCommand());
    setMock(
      createWerewolfRoomMock({
        schemaId: 'seedWolfInfectReveal',
        currentActionRole: 'seedWolf',
        myRole: 'wolf',
        mySeat: 1,
        gameStateOverrides: {
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 1 },
        },
        hookOverrides: { submitGroupConfirmAck },
      }),
    );
    const resultScreen = renderRoom();
    await waitForRoomScreen(resultScreen.getByTestId);
    const resultButtonText = getSchema('seedWolfInfectReveal').ui?.bottomActionText;
    if (!resultButtonText) throw new Error('[TEST] Missing seedWolfInfectReveal action text');
    fireEvent.press(resultScreen.getByText(resultButtonText));
    await waitFor(() => expect(harness.hasSeen('seedWolfInfectionResult')).toBe(true));
    expect(harness.getLastEventOfType('seedWolfInfectionResult')?.message).toBe(
      '你已被种狼感染并转化为普通狼人',
    );
    harness.pressPrimaryOnType('seedWolfInfectionResult');
    await waitFor(() => expect(submitGroupConfirmAck).toHaveBeenCalledTimes(1));
    resultScreen.unmount();

    harness.assertCoverage([
      'actionPrompt',
      'wolfVote',
      'wolfVoteEmpty',
      'actionConfirm',
      'skipConfirm',
      'confirmTrigger',
      'seedWolfInfectionResult',
      'witchSavePrompt',
      'witchPoisonPrompt',
      'witchNoKill',
    ]);
  });
});

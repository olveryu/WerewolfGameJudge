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
import { act, waitFor } from '@testing-library/react';

import {
  click,
  coverageChainActionPrompt,
  coverageChainSeatSelection,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonSelection,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createWerewolfRoomMock,
  getBoardByName,
  openNightActionGroup,
  pressText,
  recordAlerts,
  renderWerewolfRoom,
  RoomScreenTestHarness,
  type SubmitActionMock,
  successfulWerewolfCommand,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';
import { alertStore, dismissAlert } from '@/utils/alert';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const board = getBoardByName('种狼骑士');
if (!board) throw new Error('[TEST] Missing 种狼骑士 preset');

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

function infectionMock(submitAction: SubmitActionMock) {
  return createWerewolfRoomMock({
    schemaId: 'seedWolfInfect',
    currentActionRole: 'seedWolf',
    myRole: 'seedWolf',
    mySeat: 7,
    gameStateOverrides: {
      confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 1 },
    },
    hookOverrides: { submitAction },
  });
}

describe(`WerewolfRoomScreen UI: ${board.name}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('locks unavailable infection and confirms skipping separately', async () => {
    const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
    const screen = renderWerewolfRoom(
      createWerewolfRoomMock({
        schemaId: 'seedWolfInfect',
        currentActionRole: 'seedWolf',
        myRole: 'seedWolf',
        mySeat: 7,
        gameStateOverrides: {
          confirmStatus: { role: 'seedWolf', availability: 'unavailable', reason: 'noTarget' },
        },
        hookOverrides: { submitAction },
      }),
    );
    await waitForRoomScreen(screen);
    await openNightActionGroup(screen);
    const infection = screen.getByRole('button', { name: '感染' });
    expect(infection).toHaveAttribute('aria-disabled', 'true');
    await click(infection);
    expect(screen.getByTestId(TESTIDS.roomHandUnavailableReason)).toHaveTextContent(
      '本夜没有可感染的狼人袭击目标',
    );
    expect(submitAction).not.toHaveBeenCalled();
    await pressText(screen, '不用技能');
    await harness.pressPrimaryOnType('skipConfirm');
    expect(submitAction).toHaveBeenCalledExactlyOnceWith({ kind: 'skip' });
    screen.unmount();
  });

  it('covers board dialogs, infection choice, skip, and final acknowledgement', async () => {
    await coverageChainActionPrompt(harness, 'seedWolfInfect', 'seedWolf', 'seedWolf', 7);

    const wolfAssignments = new Map<number, RoleId>([
      [4, 'wolf'],
      [5, 'wolf'],
      [6, 'wolf'],
      [7, 'seedWolf'],
    ]);
    const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
      'wolf',
      4,
      wolfAssignments,
      1,
    );
    expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

    await coverageChainWitchSavePrompt(harness, 9);
    await coverageChainWitchPoisonSelection(harness, 9);

    const { submitAction: seerAction } = await coverageChainSeatSelection(
      'seerCheck',
      'seer',
      'seer',
      8,
      1,
    );
    expect(seerAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

    const { submitAction: seerSkipAction } = await coverageChainSkipConfirm(
      harness,
      'seerCheck',
      'seer',
      'seer',
      8,
    );
    expect(seerSkipAction).toHaveBeenCalledWith({ kind: 'skip' });

    const { submitAction: emptyVoteAction } = await coverageChainWolfVoteEmpty(
      harness,
      'wolf',
      4,
      wolfAssignments,
    );
    expect(emptyVoteAction).toHaveBeenCalledWith({ kind: 'target', target: null });

    const infectionAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
    const infectionScreen = renderWerewolfRoom(infectionMock(infectionAction));
    await waitForRoomScreen(infectionScreen);
    await pressText(infectionScreen, '感染');
    await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    expect(harness.getLastEventOfType('confirmTrigger')?.message).toBe('确定对2号发动感染吗？');
    await harness.pressPrimaryOnType('confirmTrigger');
    await waitFor(() => expect(infectionAction).toHaveBeenCalledWith({ kind: 'confirm' }));
    infectionScreen.unmount();

    const skipInfectionAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
    const skipScreen = renderWerewolfRoom(infectionMock(skipInfectionAction));
    await waitForRoomScreen(skipScreen);
    await pressText(skipScreen, '不用技能');
    expect(harness.getLastEventOfType('skipConfirm')?.message).not.toContain('2号');
    await harness.pressPrimaryOnType('skipConfirm');
    await waitFor(() => expect(skipInfectionAction).toHaveBeenCalledWith({ kind: 'skip' }));
    skipScreen.unmount();

    const resultMock = createWerewolfRoomMock({
      schemaId: 'seedWolfInfectReveal',
      currentActionRole: 'seedWolf',
      myRole: 'wolf',
      mySeat: 1,
      gameStateOverrides: {
        seedWolfInfectionResult: { outcome: 'converted', targetSeat: 1 },
      },
    });
    const resultScreen = renderWerewolfRoom(resultMock);
    await waitForRoomScreen(resultScreen);
    const resultButtonText = getSchema('seedWolfInfectReveal').ui?.bottomActionText;
    if (!resultButtonText) throw new Error('[TEST] Missing seedWolfInfectReveal action text');
    await pressText(resultScreen, resultButtonText, false);
    const prompt = alertStore.getSnapshot();
    expect(prompt?.buttons.map((button) => button.text)).toEqual(['取消', '查看']);
    expect(harness.hasSeen('seedWolfInfectionResult')).toBe(false);
    if (prompt === null) throw new Error('[TEST] Missing private status prompt');
    act(() => dismissAlert(prompt.generation));
    expect(resultMock.dispatch).not.toHaveBeenCalledWith(
      { type: 'werewolf.groupConfirm.ack' },
      expect.anything(),
    );
    await pressText(resultScreen, resultButtonText, false);
    const retryPrompt = alertStore.getSnapshot();
    const viewStatus = retryPrompt?.buttons[1]?.onPress;
    if (retryPrompt === null || viewStatus === undefined) {
      throw new Error('[TEST] Missing private status view action');
    }
    await act(async () => viewStatus());
    dismissAlert(retryPrompt.generation);
    await waitFor(() => expect(harness.hasSeen('seedWolfInfectionResult')).toBe(true));
    expect(harness.getLastEventOfType('seedWolfInfectionResult')?.message).toBe(
      '你已被种狼感染并转化为普通狼人',
    );
    await harness.pressPrimaryOnType('seedWolfInfectionResult');
    await waitFor(() =>
      expect(resultMock.dispatch).toHaveBeenCalledWith(
        { type: 'werewolf.groupConfirm.ack' },
        expect.anything(),
      ),
    );
    resultScreen.unmount();

    harness.assertCoverage([
      'actionPrompt',
      'wolfVoteEmpty',
      'skipConfirm',
      'confirmTrigger',
      'seedWolfInfectionResult',
      'witchSavePrompt',
      'witchNoKill',
    ]);
  });
});

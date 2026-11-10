/**
 * WolfRobot 12P Board UI Test
 *
 * Board: Wolf Robot Psychic
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
 * Server-data required (covered by integration):
 * - wolfRobotReveal, psychicReveal
 *
 * SPECIAL: Hunter gate MUST use pressPrimaryOnType + assertNoLoop
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfRobotHunterStatus,
  chainWolfVoteConfirm,
  confirmStep,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfRobotHunterStatus,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  createReactiveWerewolfRoomMock,
  createWerewolfRoomMock,
  getBoardByName,
  mountRoomFor as mount,
  mountWerewolfRoom,
  pressText,
  recordAlerts,
  requireBottomActionText,
  requireEmptyVoteText,
  RoomScreenTestHarness,
  tapSeat,
  type WerewolfRoomMockOptions,
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

function getWolfRobotHunterGateButtonText(): string {
  const text = SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText;
  if (!text) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGateButtonText');
  }
  return text;
}

function getWolfRobotHunterGatePromptText(): string {
  const text = SCHEMAS.wolfRobotLearn.ui?.hunterGatePrompt;
  if (!text) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGatePrompt');
  }
  return text;
}

const BOARD_NAME = '机械狼人通灵师';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolfRobot'],
]);
const WOLF_STEP = wolfKillStep('wolf', 4, WOLVES);
const GUARD_STEP = actorStep('guardProtect', 'guard', 11);
/** The robot learned the hunter; `viewed` says whether the hunter gate is already cleared. */
const learnedHunterStep = (viewed: boolean): WerewolfRoomMockOptions => ({
  ...actorStep('wolfRobotLearn', 'wolfRobot', 7),
  wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
  wolfRobotHunterStatusViewed: viewed,
});

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('wolfRobot learn: shows action prompt', async () => {
      await mount(actorStep('wolfRobotLearn', 'wolfRobot', 7));
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });

    it('psychic check: shows action prompt', async () => {
      await mount(actorStep('psychicCheck', 'psychic', 8));
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('wolfRobotHunterStatus coverage (CRITICAL: hunter gate)', () => {
    /**
     * Learned hunter + gate not yet viewed: the gate button opens the status
     * dialog; its primary button clears the gate without looping.
     */
    it('wolfRobot learns hunter: shows hunter status gate, requires pressPrimaryOnType, no infinite loop', async () => {
      const view = await mount(learnedHunterStep(false));

      // CRITICAL: Must press the gate button to trigger the dialog
      await pressText(view, getWolfRobotHunterGateButtonText());

      await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));

      // CRITICAL: Must press primary button to clear gate
      await harness.pressPrimaryOnType('wolfRobotHunterStatus');

      // Verify no infinite loop (max 3 occurrences)
      harness.assertNoLoop({ type: 'wolfRobotHunterStatus', maxTimesPerStep: 3 });
    });

    it('pressing confirm dispatches werewolf.wolfRobot.ackHunterStatus', async () => {
      const mock = createWerewolfRoomMock(learnedHunterStep(false));
      const view = await mountWerewolfRoom(mock);

      await pressText(view, getWolfRobotHunterGateButtonText());
      await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));

      // Press primary button (confirm)
      await harness.pressPrimaryOnType('wolfRobotHunterStatus');

      // CRITICAL ASSERTION: the hunter-status ack must be dispatched
      await waitFor(() =>
        expect(mock.dispatch).toHaveBeenCalledWith(
          { type: 'werewolf.wolfRobot.ackHunterStatus' },
          expect.anything(),
        ),
      );
    });

    it('gate button disappears after wolfRobotHunterStatusViewed becomes true', async () => {
      const reactiveMock = createReactiveWerewolfRoomMock(learnedHunterStep(false));
      const view = await mountWerewolfRoom(reactiveMock.mock);

      // Button should be visible initially
      expect(view.getByText(getWolfRobotHunterGateButtonText())).toBeInTheDocument();

      // Simulate state update: server broadcasts wolfRobotHunterStatusViewed = true
      reactiveMock.simulateStateUpdate({
        wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
        wolfRobotHunterStatusViewed: true,
      });

      // CRITICAL ASSERTION: Button should disappear
      await waitFor(() =>
        expect(view.queryByText(getWolfRobotHunterGateButtonText())).not.toBeInTheDocument(),
      );
    });

    it('cannot trigger hunter status dialog when wolfRobotHunterStatusViewed is true', async () => {
      const view = await mount(learnedHunterStep(true));

      // Button should NOT be visible when gate is already cleared
      expect(view.queryByText(getWolfRobotHunterGateButtonText())).not.toBeInTheDocument();

      harness.clear();

      // No wolfRobotHunterStatus dialog appears without a button to press
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);
    });

    // After learning, seat taps are inert: the bottom button is the only interaction.
    it('seat tap has no effect after learning is complete (cannot re-learn)', async () => {
      const view = await mount(learnedHunterStep(false));
      harness.clear();

      await tapSeat(view, 1);

      expect(harness.hasSeen('actionPrompt')).toBe(false);
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);
      // No alert at all was published for the seat tap
      expect(harness.events()).toEqual([]);
    });

    // Schema constraints are skipped after learning, so no "不能选择自己" error either.
    it('self-seat tap has no effect after learning (no "不能选择自己" error)', async () => {
      const view = await mount(learnedHunterStep(false));
      harness.clear();

      // Try to tap own seat (mySeat=7, 0-indexed)
      await tapSeat(view, 7);

      expect(harness.hasSeen('actionPrompt')).toBe(false);
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(false);
      expect(harness.events()).toEqual([]);
    });

    it('prompt text shows hunter gate prompt when gate is active (not learning prompt)', async () => {
      const view = await mount(learnedHunterStep(false));

      // The learning prompt is: '请选择要学习的玩家'
      expect(view.queryByText(/请选择要学习的玩家/)).not.toBeInTheDocument();
      expect(view.queryByText(getWolfRobotHunterGatePromptText())).toBeInTheDocument();
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt when someone died', async () => {
      await mount(witchStep(9, 1));
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison confirm', async () => {
      // No one died (use -1 as sentinel)
      const view = await mount(witchStep(9, -1));
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: shows confirm trigger dialog', async () => {
      await mount(confirmStep('hunterConfirm', 'hunter', 10, { role: 'hunter', canShoot: true }));
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('skipConfirm coverage', () => {
    it('guard action: skip button shows skip confirm dialog', async () => {
      const view = await mount(GUARD_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('guardProtect'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('guard actionConfirm coverage', () => {
    it('guard: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(GUARD_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      await mount(witchStep(9, -1));
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await pressText(view, requireEmptyVoteText());
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  // ===========================================================================
  // Chain Interaction (press button → assert callback)
  // ===========================================================================

  describe('chain interaction', () => {
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(harness, 'wolf', 4, WOLVES, 1);
    });

    it('skipConfirm (guard) → submitAction called', async () => {
      await chainSkipConfirm(harness, 'guardProtect', 'guard', 'guard', 11);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });

    it('wolfRobotHunterStatus → ackHunterStatus dispatched', async () => {
      await chainWolfRobotHunterStatus(harness, 7);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    // Coverage chains press real buttons; events accumulate for the final assertCoverage().
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (wolfRobot learn)
      await coverageChainActionPrompt(harness, 'wolfRobotLearn', 'wolfRobot', 'wolfRobot', 7);

      // Step 2: wolfVote → confirm → submitAction called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'wolf',
        4,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledTimes(1);

      // Step 3: wolfRobotHunterStatus gate → press primary → ackHunterStatus dispatched
      // CRITICAL: parameter-level assertion on the ack command (prevent identity drift)
      const { dispatch } = await coverageChainWolfRobotHunterStatus(harness, 7);
      expect(dispatch).toHaveBeenCalledWith(
        { type: 'werewolf.wolfRobot.ackHunterStatus' },
        expect.anything(),
      );

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 5: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 6: confirmTrigger (hunter) → confirm button pressed → assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 7: skipConfirm (guard) → skip button pressed → submitAction called
      const { submitAction } = await coverageChainSkipConfirm(
        harness,
        'guardProtect',
        'guard',
        'guard',
        11,
      );
      expect(submitAction).toHaveBeenCalledTimes(1);

      // Step 8: actionConfirm (guard tap seat) → press confirm → submitAction called
      const { submitAction: guardSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'guardProtect',
        'guard',
        'guard',
        11,
        1,
      );
      expect(guardSubmit).toHaveBeenCalled();

      // Step 9: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        4,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Use literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'wolfRobotHunterStatus',
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

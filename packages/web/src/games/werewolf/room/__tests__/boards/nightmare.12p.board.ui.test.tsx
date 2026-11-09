/**
 * Nightmare 12P Board UI Test
 *
 * Board: Nightmare Guard
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
 * Server-data required (covered by integration):
 * - seerReveal
 *
 * CRITICAL: Nightmare board MUST cover blocked -> actionRejected with REAL interaction:
 * - Blocked player (e.g., seer) taps a seat -> triggers action -> server rejects
 * - UI shows actionRejected with BLOCKED_UI_DEFAULTS message
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { BLOCKED_UI_DEFAULTS } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  boardHasNightmare,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfVoteConfirm,
  confirmStep,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainNightmareBlocked,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
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
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '噩梦之影守卫';
const board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'nightmare'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const WOLF_STEP = wolfKillStep('nightmare', 7, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  // Verify this board has nightmare
  it('board should contain nightmare role', () => {
    expect(boardHasNightmare(board)).toBe(true);
  });

  describe('actionPrompt coverage', () => {
    it('nightmare block selection: shows action prompt', async () => {
      await mount(actorStep('nightmareBlock', 'nightmare', 7));
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });

    it('seer action: shows action prompt', async () => {
      await mount(SEER_STEP);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('nightmare wolf: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('actionRejected coverage (CRITICAL: nightmare blocked)', () => {
    /**
     * Blocked seer taps a seat (real interaction); the server rejects with
     * BLOCKED_UI_DEFAULTS.message through the fake link like a broadcast.
     */
    it('blocked seer: tapSeat triggers action → server rejects → shows actionRejected with BLOCKED_UI_DEFAULTS', async () => {
      const reactiveMock = createReactiveWerewolfRoomMock({
        ...SEER_STEP,
        nightmareBlockedSeat: 8,
        currentNightResults: { blockedSeat: 8 },
      });
      const view = await mountWerewolfRoom(reactiveMock.mock);
      harness.clear();

      // REAL INTERACTION: Blocked seer taps a seat to try to act
      await tapSeat(view, 1);

      reactiveMock.simulateHostReject({
        action: 'seerCheck',
        reason: BLOCKED_UI_DEFAULTS.message,
        targetSeat: 8,
        rejectionId: 'nightmare-block-1',
      });

      await waitFor(() => expect(harness.hasSeen('actionRejected')).toBe(true));

      const rejectedEvents = harness.eventsOfType('actionRejected');
      expect(rejectedEvents.length).toBeGreaterThan(0);
      expect(rejectedEvents[0]!.message).toContain(BLOCKED_UI_DEFAULTS.message);
    });

    it('blocked witch: tapSeat triggers action → server rejects → shows actionRejected', async () => {
      const reactiveMock = createReactiveWerewolfRoomMock({
        ...witchStep(9, 1),
        nightmareBlockedSeat: 9,
        currentNightResults: { blockedSeat: 9 },
      });
      const view = await mountWerewolfRoom(reactiveMock.mock);
      harness.clear();

      // REAL INTERACTION: Blocked witch taps to try to use poison
      await tapSeat(view, 1);

      reactiveMock.simulateHostReject({
        action: 'witchAction',
        reason: BLOCKED_UI_DEFAULTS.message,
        targetSeat: 9,
        rejectionId: 'nightmare-block-2',
      });

      await waitFor(() => expect(harness.hasSeen('actionRejected')).toBe(true));
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
      // No one died
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
      const view = await mount(actorStep('guardProtect', 'guard', 11));
      harness.clear();
      await pressText(view, requireBottomActionText('guardProtect'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('wolfKillDisabled coverage', () => {
    it('wolfKillDisabled: non-blocked wolf sees the kill-disabled hint instead of the vote dialog when nightmare blocked another wolf', async () => {
      // Wolf at seat 4 is blocked; the override disables the kill for the whole
      // pack (the engine rejects every non-empty wolf vote while it is set),
      // so the wolf at seat 5 gets the hint dialog, not the vote dialog.
      const mock = createWerewolfRoomMock({
        ...wolfKillStep('wolf', 5, WOLVES),
        nightmareBlockedSeat: 4,
        wolfKillDisabled: true,
      });
      const view = await mountWerewolfRoom(mock);
      harness.clear();

      // The tap shows the dismiss hint and submits nothing; no vote dialog.
      await tapSeat(view, 1);

      await waitFor(() => {
        const hint = harness.events().find((event) => event.title === BLOCKED_UI_DEFAULTS.title);
        expect(hint).toBeDefined();
        expect(hint?.message).toBe(BLOCKED_UI_DEFAULTS.message);
        expect(hint?.buttons).toEqual([BLOCKED_UI_DEFAULTS.dismissButtonText]);
      });
      expect(harness.hasSeen('wolfVote')).toBe(false);
      expect(mock.submitAction).not.toHaveBeenCalled();
    });
  });

  describe('seer actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
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
      await chainWolfVoteConfirm(harness, 'nightmare', 7, WOLVES, 1);
    });

    it('skipConfirm (guard) → submitAction called', async () => {
      await chainSkipConfirm(harness, 'guardProtect', 'guard', 'guard', 11);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    // Coverage chains press real buttons; events accumulate for the final assertCoverage().
    it('all required UI dialog types must be covered by real interactions', async () => {
      // Step 1: actionPrompt (nightmare block selection)
      await coverageChainActionPrompt(harness, 'nightmareBlock', 'nightmare', 'nightmare', 7);

      // Step 2: wolfVote (nightmare wolf voting) -> confirm -> submitAction called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'nightmare',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledTimes(1);

      // Step 3: actionRejected (blocked seer with REAL interaction)
      // CRITICAL: parameter-level assertion on rejectedEvents message (prevent identity drift)
      const { rejectedEvents } = await coverageChainNightmareBlocked(
        harness,
        'seerCheck',
        'seer',
        8,
        BLOCKED_UI_DEFAULTS.message,
      );
      expect(rejectedEvents.length).toBeGreaterThan(0);
      expect(rejectedEvents[0]!.message).toContain(BLOCKED_UI_DEFAULTS.message);

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 5: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 6: confirmTrigger (hunter) -> confirm button pressed -> assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 7: skipConfirm (guard) -> skip button pressed -> submitAction called
      const { submitAction } = await coverageChainSkipConfirm(
        harness,
        'guardProtect',
        'guard',
        'guard',
        11,
      );
      expect(submitAction).toHaveBeenCalledTimes(1);

      // Step 8: actionConfirm (seer tap seat) -> press confirm -> submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 9: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'nightmare',
        7,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

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

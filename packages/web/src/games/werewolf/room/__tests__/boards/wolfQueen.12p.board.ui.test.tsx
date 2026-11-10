/**
 * WolfQueen 12P Board UI Test
 *
 * Board: Wolf Queen Guard
 * Roles: 4x villager, 3x wolf, wolfQueen, seer, witch, hunter, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainConfirmTrigger,
  chainSkipConfirm,
  chainWolfVoteConfirm,
  confirmStep,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainSeatActionConfirm,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonPrompt,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  getBoardByName,
  mountRoomFor as mount,
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

const BOARD_NAME = '狼美守卫';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolfQueen'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const CHARM_STEP = actorStep('wolfQueenCharm', 'wolfQueen', 7);
const WOLF_STEP = wolfKillStep('wolfQueen', 7, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('seer action: shows action prompt', async () => {
      await mount(SEER_STEP);
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

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      await mount(witchStep(9, 1));
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison', async () => {
      const view = await mount(witchStep(9, -1));
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 10, { role: 'hunter', canShoot: true }),
      );
      const bottomActionText = requireBottomActionText('hunterConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
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

  describe('seer actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  // ===========================================================================
  // Role-specific schema: wolfQueenCharm (not proxied through seer)
  // ===========================================================================

  describe('wolfQueenCharm actionPrompt coverage', () => {
    it('wolfQueen charm: shows action prompt', async () => {
      await mount(CHARM_STEP);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfQueenCharm actionConfirm coverage', () => {
    it('wolfQueen charm: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(CHARM_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('wolfQueenCharm skipConfirm coverage', () => {
    it('wolfQueen charm: skip button shows skipConfirm dialog', async () => {
      const view = await mount(CHARM_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('wolfQueenCharm'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
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
  // Chain Interaction (press button -> assert callback)
  // ===========================================================================

  describe('chain interaction', () => {
    it('wolfVote confirm -> submitAction called', async () => {
      await chainWolfVoteConfirm(harness, 'wolfQueen', 7, WOLVES, 1);
    });

    it('skipConfirm (guard) -> submitAction called', async () => {
      await chainSkipConfirm(harness, 'guardProtect', 'guard', 'guard', 11);
    });

    it('confirmTrigger (hunter) -> dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolfVote -> press confirm -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'wolfQueen',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 5: skipConfirm (guard) -> press primary -> submitAction called
      const { submitAction: guardSubmit } = await coverageChainSkipConfirm(
        harness,
        'guardProtect',
        'guard',
        'guard',
        11,
      );
      expect(guardSubmit).toHaveBeenCalled();

      // Step 6: confirmTrigger (hunter) -> press primary + assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 7: actionConfirm (seer tap seat) -> press confirm -> submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolfQueen',
        7,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

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

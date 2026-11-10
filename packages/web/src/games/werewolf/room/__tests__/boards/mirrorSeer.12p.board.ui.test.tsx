/**
 * MirrorSeer 12P Board UI Test
 *
 * Board: Mirror Seer
 * Roles: 3x villager, 3x wolf, darkWolfKing, seer, mirrorSeer, witch, guard, knight
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, wolfVoteEmpty, witchSavePrompt, witchPoisonPrompt, witchNoKill
 * - confirmTrigger (darkWolfKingConfirm)
 * - actionConfirm, skipConfirm (seer, mirrorSeer, guard)
 *
 * Server-data required (covered by integration):
 * - seerReveal, mirrorSeerReveal
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainConfirmTrigger,
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

const BOARD_NAME = '灯影预言家';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [3, 'wolf'],
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'darkWolfKing'],
]);
const MIRROR_STEP = actorStep('mirrorSeerCheck', 'mirrorSeer', 8);
const WOLF_STEP = wolfKillStep('wolf', 3, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('mirrorSeer action: shows action prompt', async () => {
      await mount(MIRROR_STEP);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });

    it('guard action: shows action prompt', async () => {
      await mount(actorStep('guardProtect', 'guard', 10));
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

  describe('mirrorSeer actionConfirm coverage', () => {
    it('mirrorSeer: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(MIRROR_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('mirrorSeer skipConfirm coverage', () => {
    it('mirrorSeer: skip button shows skipConfirm dialog', async () => {
      const view = await mount(MIRROR_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('mirrorSeerCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      await mount(witchStep(9, -1));
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('darkWolfKingConfirm', 'darkWolfKing', 6, {
          role: 'darkWolfKing',
          canShoot: true,
        }),
      );
      const bottomActionText = requireBottomActionText('darkWolfKingConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
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

  describe('chain interaction', () => {
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(harness, 'wolf', 3, WOLVES, 1);
    });

    it('confirmTrigger (darkWolfKing) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'darkWolfKingConfirm', 'darkWolfKing', 'darkWolfKing', 6);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (mirrorSeer)
      await coverageChainActionPrompt(harness, 'mirrorSeerCheck', 'mirrorSeer', 'mirrorSeer', 8);

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'wolf',
        3,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 5: confirmTrigger (darkWolfKing) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        6,
      );

      // Step 6: actionConfirm (mirrorSeer tap seat) → press confirm → submitAction called
      const { submitAction: mirrorSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'mirrorSeerCheck',
        'mirrorSeer',
        'mirrorSeer',
        8,
        1,
      );
      expect(mirrorSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (mirrorSeer) → press primary → submitAction called
      const { submitAction: mirrorSkip } = await coverageChainSkipConfirm(
        harness,
        'mirrorSeerCheck',
        'mirrorSeer',
        'mirrorSeer',
        8,
      );
      expect(mirrorSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        3,
        WOLVES,
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

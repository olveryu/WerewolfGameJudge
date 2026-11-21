/**
 * MirrorSeer 12P Board UI Test
 *
 * Board: Mirror Seer
 * Roles: 3x villager, 3x wolf, darkWolfKing, seer, mirrorSeer, witch, guard, knight
 *
 * Required UI coverage:
 * - actionPrompt, wolfVote, wolfVoteEmpty, witchSavePrompt, witch poison selection, witchNoKill
 * - confirmTrigger (darkWolfKingConfirm)
 * - seat selection, skipConfirm (seer, mirrorSeer, guard)
 *
 * Server-data required (covered by integration):
 * - seerReveal, mirrorSeerReveal
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainConfirmTrigger,
  chainWolfVote,
  confirmStep,
  coverageChainActionPrompt,
  coverageChainConfirmTrigger,
  coverageChainSeatSelection,
  coverageChainSkipConfirm,
  coverageChainWitchPoisonSelection,
  coverageChainWitchSavePrompt,
  coverageChainWolfVote,
  coverageChainWolfVoteEmpty,
  draftSeatSelection,
  getBoardByName,
  mountRoomFor as mount,
  pressText,
  recordAlerts,
  requireBottomActionText,
  requireEmptyVoteText,
  RoomScreenTestHarness,
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
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
    });

    it('guard action: shows action prompt', async () => {
      await mount(actorStep('guardProtect', 'guard', 10));
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
    });
  });

  describe('wolf vote selection coverage', () => {
    it('wolf vote: drafting a target enables vote submission', async () => {
      const view = await mount(WOLF_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      await mount(witchStep(9, 1));
      await waitFor(() => harness.expectInlineStatus('witchSavePrompt'));
    });
  });

  describe('witch poison selection coverage', () => {
    it('witch action: drafting a poison target enables submission', async () => {
      const view = await mount(witchStep(9, -1));
      await draftSeatSelection(view, 1);
    });
  });

  describe('mirrorSeer seat selection coverage', () => {
    it('mirrorSeer: drafting a target enables submission', async () => {
      const view = await mount(MIRROR_STEP);
      await draftSeatSelection(view, 1);
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
      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
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
    it('wolf target submission → submitAction called', async () => {
      await chainWolfVote('wolf', 3, WOLVES, 1);
    });

    it('confirmTrigger (darkWolfKing) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'darkWolfKingConfirm', 'darkWolfKing', 'darkWolfKing', 6);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (mirrorSeer)
      await coverageChainActionPrompt(harness, 'mirrorSeerCheck', 'mirrorSeer', 'mirrorSeer', 8);

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('wolf', 3, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 9);

      // Step 5: confirmTrigger (darkWolfKing) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        6,
      );

      // Step 6: seat selection (mirrorSeer target) → press confirm → submitAction called
      const { submitAction: mirrorSubmit } = await coverageChainSeatSelection(
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
        'wolfVoteEmpty',
        'confirmTrigger',
        'witchSavePrompt',
        'witchNoKill',

        'skipConfirm',
      ]);
    });
  });
});

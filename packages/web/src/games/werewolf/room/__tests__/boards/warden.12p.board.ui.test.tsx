/**
 * Warden 12P Board UI Test
 *
 * Board: All-in
 * Roles: 4x villager, 3x wolf, warden, seer, witch, hunter, dreamcatcher
 *
 * Required UI coverage:
 * - actionPrompt, wolfVote, wolfVoteEmpty, confirmTrigger,
 *   witchSavePrompt, witch poison selection, witchNoKill, seat selection, skipConfirm
 *
 * Note: warden has no night-1 action; confirmTrigger comes from hunter
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

const BOARD_NAME = '孤注一掷';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'warden'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const DREAM_STEP = actorStep('dreamcatcherDream', 'dreamcatcher', 11);
const WOLF_STEP = wolfKillStep('warden', 7, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('dreamcatcher action: shows action prompt', async () => {
      await mount(DREAM_STEP);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolf vote selection coverage', () => {
    it('warden vote: drafting a target enables vote submission', async () => {
      const view = await mount(WOLF_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 10, { role: 'hunter', canShoot: true }),
      );
      const bottomActionText = requireBottomActionText('hunterConfirm');
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
      await mount(witchStep(9, 1));
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witch poison selection coverage', () => {
    it('witch action: drafting a poison target enables submission', async () => {
      const view = await mount(witchStep(9, -1));
      await draftSeatSelection(view, 1);
    });
  });

  describe('seer seat selection coverage', () => {
    it('seer: drafting a target enables submission', async () => {
      const view = await mount(SEER_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('seer skipConfirm coverage', () => {
    it('seer: skip button shows skipConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('seerCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  // ===========================================================================
  // Role-specific schema: dreamcatcherDream
  // ===========================================================================

  describe('dreamcatcherDream seat selection coverage', () => {
    it('dreamcatcher: drafting a target enables submission', async () => {
      const view = await mount(DREAM_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('dreamcatcherDream skipConfirm coverage', () => {
    it('dreamcatcher: skip button shows skipConfirm dialog', async () => {
      const view = await mount(DREAM_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('dreamcatcherDream'));
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
  // Chain Interaction (press button → assert callback)
  // ===========================================================================

  describe('chain interaction', () => {
    it('wolf target submission → submitAction called', async () => {
      await chainWolfVote('warden', 7, WOLVES, 1);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (dreamcatcher)
      await coverageChainActionPrompt(
        harness,
        'dreamcatcherDream',
        'dreamcatcher',
        'dreamcatcher',
        11,
      );

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('warden', 7, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (hunter) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 5: witch poison selection
      await coverageChainWitchPoisonSelection(9);

      // Step 6: seat selection (seer) → submit → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatSelection(
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (seer) → press primary → submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'warden',
        7,
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

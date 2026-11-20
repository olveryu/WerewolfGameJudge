/**
 * Slacker 12P Board UI Test
 *
 * Board: Seer-Witch-Hunter-Villager-Slacker
 * Roles: 3x villager, 4x wolf, slacker, seer, witch, hunter, idiot
 *
 * Required UI coverage:
 * - actionPrompt: seer, witch, hunter, slacker actions
 * - wolfVote: draft and submit a target
 * - witchSavePrompt: witch save flow
 * - witch poison target selection
 * - confirmTrigger: hunter confirm trigger
 *
 * Server-data required (covered by integration):
 * - seerReveal
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

const BOARD_NAME = '预女猎白混';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolf'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 9);
const WOLF_STEP = wolfKillStep('wolf', 4, WOLVES);

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
    it('witch action: shows save prompt when someone died', async () => {
      await mount(witchStep(10, 1));
      await waitFor(() => harness.expectInlineStatus('witchSavePrompt'));
    });
  });

  describe('witch poison selection coverage', () => {
    it('witch action: drafting a poison target enables submission', async () => {
      const view = await mount(witchStep(10, -1));
      await draftSeatSelection(view, 1);
    });
  });

  describe('confirmTrigger coverage', () => {
    const bottomActionText = requireBottomActionText('hunterConfirm');

    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 11, { role: 'hunter', canShoot: true }),
      );
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });

    it('hunter poisoned: confirmTrigger shows cannotShoot message', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 11, { role: 'hunter', canShoot: false }),
      );
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));

      const event = harness.getLastEventOfType('confirmTrigger');
      expect(event).not.toBeNull();
      expect(event!.message).toContain('不能发动');
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

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      await mount(witchStep(10, -1));
      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
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
    it('wolf target submission -> submitAction called', async () => {
      await chainWolfVote('wolf', 4, WOLVES, 1);
    });

    it('confirmTrigger (hunter) -> dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 11);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 9);

      // Step 2: wolfVote -> press confirm -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('wolf', 4, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 10);

      // Step 4: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 10);

      // Step 5: confirmTrigger (hunter) -> press primary + assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 11);

      // Step 6: seat selection (seer target) → submit → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatSelection(
        'seerCheck',
        'seer',
        'seer',
        9,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (seer) -> press primary -> submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        9,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        4,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVoteEmpty',
        'witchSavePrompt',
        'witchNoKill',

        'skipConfirm',
        'confirmTrigger',
      ]);
    });
  });
});

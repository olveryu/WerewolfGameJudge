/**
 * CursedFox 12P Board UI Test
 *
 * Board: Cursed Fox Crow
 * Roles: 4x villager, 2x wolf, darkWolfKing, cursedFox, seer, witch, hunter, crow
 *
 * Required UI coverage:
 * - actionPrompt, wolfVote, wolfVoteEmpty, confirmTrigger,
 *   witchSavePrompt, witch poison selection, witchNoKill,
 *   seat selection, skipConfirm
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

const BOARD_NAME = '咒狐乌鸦';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'darkWolfKing'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 9);
const WOLF_STEP = wolfKillStep('darkWolfKing', 7, WOLVES);

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
    it('darkWolfKing vote: drafting a target enables vote submission', async () => {
      const view = await mount(WOLF_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('darkWolfKingConfirm', 'darkWolfKing', 7, {
          role: 'darkWolfKing',
          canShoot: true,
        }),
      );
      const bottomActionText = requireBottomActionText('darkWolfKingConfirm');
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });

    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 11, { role: 'hunter', canShoot: true }),
      );
      const bottomActionText = requireBottomActionText('hunterConfirm');
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt', async () => {
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

  describe('skipConfirm coverage', () => {
    it('seer action: skip button shows skip confirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('seerCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
    });
  });

  describe('seer seat selection coverage', () => {
    it('seer: drafting a target enables submission', async () => {
      const view = await mount(SEER_STEP);
      await draftSeatSelection(view, 1);
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
      await chainWolfVote('darkWolfKing', 7, WOLVES, 1);
    });

    it('confirmTrigger (darkWolfKing) -> dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'darkWolfKingConfirm', 'darkWolfKing', 'darkWolfKing', 7);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 9);

      // Step 2: wolf target selection → submit -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        'darkWolfKing',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (darkWolfKing) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 10);

      // Step 5: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 10);

      // Step 6: skipConfirm (seer) → press primary -> submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        9,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 7: seat selection (seer) → submit -> submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatSelection(
        'seerCheck',
        'seer',
        'seer',
        9,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty → press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'darkWolfKing',
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

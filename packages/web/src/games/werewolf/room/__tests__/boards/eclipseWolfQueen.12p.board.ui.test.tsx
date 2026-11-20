/**
 * EclipseWolfQueen 12P Board UI Test
 *
 * Board: Eternal Order
 * Roles: 4x villager, 3x wolf, eclipseWolfQueen, seer, witch, guard, sequencePrince
 *
 * Required UI coverage:
 * - actionPrompt, wolfVote, wolfVoteEmpty,
 *   witchSavePrompt, witch poison selection, witchNoKill, seat selection, skipConfirm
 *
 * Note: sequencePrince has no night-1 action (triggered ability)
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainWolfVote,
  coverageChainActionPrompt,
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

const BOARD_NAME = '永序之轮';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'eclipseWolfQueen'],
]);
const SHELTER_STEP = actorStep('eclipseWolfQueenShelter', 'eclipseWolfQueen', 7);
const WOLF_STEP = wolfKillStep('eclipseWolfQueen', 7, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('eclipseWolfQueen action: shows action prompt', async () => {
      await mount(SHELTER_STEP);
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
    });
  });

  describe('wolf vote selection coverage', () => {
    it('eclipseWolfQueen vote: drafting a target enables vote submission', async () => {
      const view = await mount(WOLF_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('eclipseWolfQueenShelter seat selection coverage', () => {
    it('eclipseWolfQueen: drafting a target enables submission', async () => {
      const view = await mount(SHELTER_STEP);
      await draftSeatSelection(view, 1);
    });
  });

  describe('eclipseWolfQueenShelter skipConfirm coverage', () => {
    it('eclipseWolfQueen: skip button shows skipConfirm dialog', async () => {
      const view = await mount(SHELTER_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('eclipseWolfQueenShelter'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
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

  describe('witchNoKill coverage', () => {
    it('witch: shows witchNoKill when killedSeat=-1', async () => {
      await mount(witchStep(9, -1));
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

  describe('chain interaction', () => {
    it('wolf target submission → submitAction called', async () => {
      await chainWolfVote('eclipseWolfQueen', 7, WOLVES, 1);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (eclipseWolfQueen)
      await coverageChainActionPrompt(
        harness,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
      );

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        'eclipseWolfQueen',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 9);

      // Step 5: seat selection (eclipseWolfQueen target)
      const { submitAction: shelterSubmit } = await coverageChainSeatSelection(
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
        1,
      );
      expect(shelterSubmit).toHaveBeenCalled();

      // Step 6: skipConfirm (eclipseWolfQueen)
      const { submitAction: shelterSkip } = await coverageChainSkipConfirm(
        harness,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
      );
      expect(shelterSkip).toHaveBeenCalled();

      // Step 7: wolfVoteEmpty → press confirm → submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'eclipseWolfQueen',
        7,
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
      ]);
    });
  });
});

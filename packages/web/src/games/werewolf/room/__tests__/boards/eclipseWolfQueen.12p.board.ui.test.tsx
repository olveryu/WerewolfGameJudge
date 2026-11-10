/**
 * EclipseWolfQueen 12P Board UI Test
 *
 * Board: Eternal Order
 * Roles: 4x villager, 3x wolf, eclipseWolfQueen, seer, witch, guard, sequencePrince
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, wolfVoteEmpty,
 *   witchSavePrompt, witchPoisonPrompt, witchNoKill, actionConfirm, skipConfirm
 *
 * Note: sequencePrince has no night-1 action (triggered ability)
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  chainWolfVoteConfirm,
  coverageChainActionPrompt,
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
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('eclipseWolfQueen vote: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('eclipseWolfQueenShelter actionConfirm coverage', () => {
    it('eclipseWolfQueen: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(SHELTER_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
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

  describe('chain interaction', () => {
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(harness, 'eclipseWolfQueen', 7, WOLVES, 1);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (eclipseWolfQueen)
      await coverageChainActionPrompt(
        harness,
        'eclipseWolfQueenShelter',
        'eclipseWolfQueen',
        'eclipseWolfQueen',
        7,
      );

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'eclipseWolfQueen',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 5: actionConfirm (eclipseWolfQueen tap seat)
      const { submitAction: shelterSubmit } = await coverageChainSeatActionConfirm(
        harness,
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
        'wolfVote',
        'wolfVoteEmpty',
        'witchSavePrompt',
        'witchNoKill',
        'witchPoisonPrompt',
        'actionConfirm',
        'skipConfirm',
      ]);
    });
  });
});

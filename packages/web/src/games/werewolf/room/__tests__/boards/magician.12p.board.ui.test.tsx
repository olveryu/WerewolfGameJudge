/**
 * Magician 12P Board UI Test
 *
 * Board: Wolf King Magician
 * Roles: 4x villager, 3x wolf, darkWolfKing, seer, witch, hunter, magician
 *
 * Required UI coverage:
 * - actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witch poison selection,
 *   two-target swap selection
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
  coverageChainMagicianSwap,
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
  seatSelectionSubmitButton,
  startSeatSelection,
  tapSeat,
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '狼王魔术师';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'darkWolfKing'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const MAGICIAN_STEP = actorStep('magicianSwap', 'magician', 11);
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
    it('darkWolfKing confirm: shows confirm trigger', async () => {
      await mount(actorStep('darkWolfKingConfirm', 'darkWolfKing', 7));
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
    });

    it('hunter confirm: shows confirm trigger', async () => {
      await mount(confirmStep('hunterConfirm', 'hunter', 10, { role: 'hunter', canShoot: true }));
      await waitFor(() => harness.expectInlineStatus('actionPrompt'));
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

  describe('first swap pick', () => {
    it('magician swap: one target is drafted but cannot be submitted', async () => {
      const view = await mount(MAGICIAN_STEP);
      await startSeatSelection(view);
      expect(view.queryByText('可选')).not.toBeInTheDocument();
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).toHaveAttribute(
        'data-highlight',
        'none',
      );
      await tapSeat(view, 1);
      expect(view.getByTestId(TESTIDS.seatTilePressable(1))).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(view.queryByTestId(TESTIDS.seatProgress(1))).not.toBeInTheDocument();
      expect(view.getByText('已选 1 / 2 人')).toBeInTheDocument();
      expect(seatSelectionSubmitButton(view)).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('seat selection coverage', () => {
    // Both taps run in one render: the first pick lives in the screen's interaction state.
    it('magician swap: two picks enable submission', async () => {
      const view = await mount(MAGICIAN_STEP);
      await startSeatSelection(view);
      await tapSeat(view, 1);
      await tapSeat(view, 2);
      expect(view.getByText('已选 2 / 2 人')).toBeInTheDocument();
      expect(seatSelectionSubmitButton(view)).toBeEnabled();
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

  // ===========================================================================
  // Chain Interaction (press button → assert callback)
  // ===========================================================================

  describe('chain interaction', () => {
    it('wolf target submission → submitAction called', async () => {
      await chainWolfVote('darkWolfKing', 7, WOLVES, 1);
    });

    it('confirmTrigger (hunter) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);
    });

    it('magician swap submission → submitAction called', async () => {
      await coverageChainMagicianSwap(11, 1, 2);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        'darkWolfKing',
        7,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (darkWolfKing/hunter) → press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        7,
      );

      // Step 4: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 5: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 9);

      // Step 6: magicianSwap → draft two targets → submit
      const { submitAction: magicianSubmit } = await coverageChainMagicianSwap(11, 1, 2);
      expect(magicianSubmit).toHaveBeenCalled();

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

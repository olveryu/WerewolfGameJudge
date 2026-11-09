/**
 * TreasureMaster 12P Board UI Test
 *
 * Board: Treasure Master
 * Roles: 5x villager, 3x wolf, darkWolfKing, psychic, poisoner, hunter,
 *        dreamcatcher, crow, treasureMaster (15 roles -> 12 players + 3 bottom cards)
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: psychic, dreamcatcher actions
 * - wolfVote: wolf vote dialog
 * - wolfVoteEmpty: wolf empty knife
 * - actionConfirm: psychic/dreamcatcher seat tap confirm
 * - skipConfirm: psychic/dreamcatcher skip
 * - confirmTrigger: hunter/darkWolfKing confirm trigger
 *
 * Server-data required (covered by integration):
 * - psychicReveal
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
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '盗宝大师';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [6, 'wolf'],
  [7, 'wolf'],
  [8, 'wolf'],
  [9, 'darkWolfKing'],
]);
const PSYCHIC_STEP = actorStep('psychicCheck', 'psychic', 10);
const WOLF_STEP = wolfKillStep('darkWolfKing', 9, WOLVES);

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe(`WerewolfRoomScreen UI: ${BOARD_NAME}`, () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('actionPrompt coverage', () => {
    it('psychic action: shows action prompt', async () => {
      await mount(PSYCHIC_STEP);
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('darkWolfKing vote: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('darkWolfKing confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('darkWolfKingConfirm', 'darkWolfKing', 9, {
          role: 'darkWolfKing',
          canShoot: true,
        }),
      );
      const bottomActionText = requireBottomActionText('darkWolfKingConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });

    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 11, { role: 'hunter', canShoot: true }),
      );
      const bottomActionText = requireBottomActionText('hunterConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('psychic actionConfirm coverage', () => {
    it('psychic: seat tap shows actionConfirm dialog', async () => {
      const view = await mount(PSYCHIC_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('psychic skipConfirm coverage', () => {
    it('psychic: skip button shows skipConfirm dialog', async () => {
      const view = await mount(PSYCHIC_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('psychicCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
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
    it('wolfVote confirm → submitAction called', async () => {
      await chainWolfVoteConfirm(harness, 'darkWolfKing', 9, WOLVES, 1);
    });

    it('skipConfirm (psychic) → submitAction called', async () => {
      await chainSkipConfirm(harness, 'psychicCheck', 'psychic', 'psychic', 10);
    });

    it('confirmTrigger (darkWolfKing) → dialog dismissed', async () => {
      await chainConfirmTrigger(harness, 'darkWolfKingConfirm', 'darkWolfKing', 'darkWolfKing', 9);
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (psychic)
      await coverageChainActionPrompt(harness, 'psychicCheck', 'psychic', 'psychic', 10);

      // Step 2: wolfVote -> press confirm -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'darkWolfKing',
        9,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (darkWolfKing) -> press primary + assertNoLoop
      await coverageChainConfirmTrigger(
        harness,
        'darkWolfKingConfirm',
        'darkWolfKing',
        'darkWolfKing',
        9,
      );

      // Step 4: actionConfirm (psychic tap seat) -> press confirm -> submitAction called
      const { submitAction: psychicSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
        1,
      );
      expect(psychicSubmit).toHaveBeenCalled();

      // Step 5: skipConfirm (psychic) -> press primary -> submitAction called
      const { submitAction: psychicSkip } = await coverageChainSkipConfirm(
        harness,
        'psychicCheck',
        'psychic',
        'psychic',
        10,
      );
      expect(psychicSkip).toHaveBeenCalled();

      // Step 6: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'darkWolfKing',
        9,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVote',
        'wolfVoteEmpty',
        'actionConfirm',
        'skipConfirm',
        'confirmTrigger',
      ]);
    });
  });
});

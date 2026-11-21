/**
 * ThiefCupid 12P Board UI Test
 *
 * Board: Thief Cupid
 * Roles: 5x villager, 3x wolf, seer, witch, hunter, idiot,
 *        thief, cupid (14 roles -> 12 players + 2 bottom cards)
 *
 * Required UI coverage:
 * - actionPrompt: seer actions
 * - wolfVote: draft and submit a target
 * - wolfVoteEmpty: wolf empty knife
 * - seat selection: seer seat tap confirm
 * - skipConfirm: seer skip
 * - confirmTrigger: hunter confirm trigger
 * - witchSavePrompt / witch poison selection / witchNoKill: witch dialogs
 *
 * Server-data required (covered by integration):
 * - seerReveal
 */

import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
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
  type WerewolfRoomMockOptions,
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '盗贼丘比特';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolf'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const WOLF_STEP = wolfKillStep('wolf', 5, WOLVES);
const witchWithContext = (
  witchContext: NonNullable<GameState['witchContext']>,
): WerewolfRoomMockOptions => ({ ...actorStep('witchAction', 'witch', 9), witchContext });

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

  describe('wolf vote selection coverage', () => {
    it('wolf vote: drafting a target enables vote submission', async () => {
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

  describe('wolfVoteEmpty coverage', () => {
    it('wolf: empty knife button shows wolfVoteEmpty dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await pressText(view, requireEmptyVoteText());
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  describe('witch dialog coverage', () => {
    it('witchSave: shows witchSavePrompt', async () => {
      await mount(witchWithContext({ killedSeat: 2, canSave: true, canPoison: true }));
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });

    it('witchPoison: pressing poison button shows witch poison selection', async () => {
      const view = await mount(
        witchWithContext({ killedSeat: 2, canSave: false, canPoison: true }),
      );
      await draftSeatSelection(view, 1);
    });

    it('witchNoKill: shows witchNoKill dialog when no kill', async () => {
      await mount(witchStep(9, -1));
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  // ===========================================================================
  // Coverage Assertion (MUST PASS)
  // ===========================================================================

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions and effect assertions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolfVote -> press confirm -> submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('wolf', 5, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (hunter) -> press primary + assertNoLoop
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 4: seat selection (seer target) → submit → submitAction called
      const { submitAction: seerSubmit } = await coverageChainSeatSelection(
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 5: skipConfirm (seer) -> press primary -> submitAction called
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 6: wolfVoteEmpty -> press confirm -> submitAction(null) called
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        5,
        WOLVES,
      );
      expect(emptyVote).toHaveBeenCalledWith({ kind: 'target', target: null });

      // Step 7: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 8: witch poison selection
      await coverageChainWitchPoisonSelection(9);

      // Step 9: witchNoKill
      const view = await mount(
        witchWithContext({ killedSeat: -1, canSave: false, canPoison: false }),
      );
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
      view.unmount();

      // Final: literal coverage requirements
      harness.assertCoverage([
        'actionPrompt',
        'wolfVoteEmpty',
        'skipConfirm',
        'confirmTrigger',
        'witchSavePrompt',
        'witchNoKill',
      ]);
    });
  });
});

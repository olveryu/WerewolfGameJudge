/**
 * Shadow + Avenger 12P Board UI Test
 *
 * Board: Shadow Avenger
 * Roles: 3x villager, 3x wolf, shadow, avenger, slacker, seer, witch, guard
 *
 * Required UI coverage:
 * - actionPrompt: seer, witch, shadow, guard actions
 * - wolfVote: draft and submit a target
 * - witchSavePrompt: witch save flow
 * - witch poison target selection
 * - confirmTrigger: avenger confirm trigger
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { Team } from '@game-judge/game-engine/games/werewolf/public';
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
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const BOARD_NAME = '影子复仇者';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [2, 'wolf'],
  [3, 'wolf'],
  [4, 'wolf'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
const WOLF_STEP = wolfKillStep('wolf', 2, WOLVES);

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

    it('wolf vote: empty target shows wolfVoteEmpty dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await pressText(view, requireEmptyVoteText());
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  describe('witchSavePrompt coverage', () => {
    it('witch action: shows save prompt when someone died', async () => {
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
    it('witch action: shows no-kill info when nobody died', async () => {
      await mount(witchStep(9, -1));
      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
    });
  });

  describe('confirmTrigger coverage (avenger)', () => {
    it('avenger confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('avengerConfirm', 'avenger', 1, { role: 'avenger', faction: Team.Good }),
      );
      const bottomActionText = requireBottomActionText('avengerConfirm');
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('shadow seat selection coverage', () => {
    it('shadow: drafting a target enables submission', async () => {
      const view = await mount(actorStep('shadowChooseMimic', 'shadow', 0));
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

  describe('guard seat selection + skipConfirm coverage', () => {
    it('guard: drafting a target enables submission', async () => {
      const view = await mount(actorStep('guardProtect', 'guard', 10));
      await draftSeatSelection(view, 1);
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI flows covered with chain interactions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolf target selection → submit → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote('wolf', 2, WOLVES, 1);
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witch poison selection
      await coverageChainWitchPoisonSelection(harness, 9);

      // Step 5: confirmTrigger (avenger)
      await coverageChainConfirmTrigger(harness, 'avengerConfirm', 'avenger', 'avenger', 1);

      // Step 6: seat selection (shadow target)
      const { submitAction: shadowSubmit } = await coverageChainSeatSelection(
        'shadowChooseMimic',
        'shadow',
        'shadow',
        0,
        1,
      );
      expect(shadowSubmit).toHaveBeenCalled();

      // Step 7: skipConfirm (seer)
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 8: wolfVoteEmpty
      const { submitAction: emptyVote } = await coverageChainWolfVoteEmpty(
        harness,
        'wolf',
        2,
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

/**
 * Shadow + Avenger 12P Board UI Test
 *
 * Board: Shadow Avenger
 * Roles: 3x villager, 3x wolf, shadow, avenger, slacker, seer, witch, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt: seer, witch, shadow, guard actions
 * - wolfVote: wolf vote dialog
 * - witchSavePrompt: witch save flow
 * - witchPoisonPrompt: witch poison flow
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
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
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
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
    });
  });

  describe('witchPoisonPrompt coverage', () => {
    it('witch action: tapping seat triggers poison confirm', async () => {
      const view = await mount(witchStep(9, -1));
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('witchPoisonPrompt')).toBe(true));
    });
  });

  describe('witchNoKill coverage', () => {
    it('witch action: shows no-kill info when nobody died', async () => {
      await mount(witchStep(9, -1));
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));
    });
  });

  describe('confirmTrigger coverage (avenger)', () => {
    it('avenger confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('avengerConfirm', 'avenger', 1, { role: 'avenger', faction: Team.Good }),
      );
      const bottomActionText = requireBottomActionText('avengerConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('shadow actionConfirm coverage', () => {
    it('shadow: seat tap shows actionConfirm dialog', async () => {
      const view = await mount(actorStep('shadowChooseMimic', 'shadow', 0));
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('seer actionConfirm coverage', () => {
    it('seer: seat tap shows actionConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
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

  describe('guard actionConfirm + skipConfirm coverage', () => {
    it('guard: seat tap shows actionConfirm', async () => {
      const view = await mount(actorStep('guardProtect', 'guard', 10));
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('Coverage Assertion (MUST PASS)', () => {
    it('all required UI dialog types covered with chain interactions', async () => {
      // Step 1: actionPrompt (seer)
      await coverageChainActionPrompt(harness, 'seerCheck', 'seer', 'seer', 8);

      // Step 2: wolfVote → press confirm → submitAction(1) called
      const { submitAction: wolfVoteAction } = await coverageChainWolfVote(
        harness,
        'wolf',
        2,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: witchSavePrompt
      await coverageChainWitchSavePrompt(harness, 9);

      // Step 4: witchPoisonPrompt
      await coverageChainWitchPoisonPrompt(harness, 9);

      // Step 5: confirmTrigger (avenger)
      await coverageChainConfirmTrigger(harness, 'avengerConfirm', 'avenger', 'avenger', 1);

      // Step 6: actionConfirm (shadow tap seat)
      const { submitAction: shadowSubmit } = await coverageChainSeatActionConfirm(
        harness,
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
        'wolfVote',
        'wolfVoteEmpty',
        'witchSavePrompt',
        'witchNoKill',
        'witchPoisonPrompt',
        'actionConfirm',
        'skipConfirm',
        'confirmTrigger',
      ]);
    });
  });
});

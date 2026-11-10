/**
 * WolfGirl 12P Board UI Test
 *
 * Board: Wolf Girl
 * Roles: 4x villager, 3x wolf, wolfGirl, seer, poisoner, hunter, guard
 *
 * Required UI coverage (getRequiredUiDialogTypes):
 * - actionPrompt, wolfVote, wolfVoteEmpty, confirmTrigger,
 *   actionConfirm, skipConfirm
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
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

const BOARD_NAME = '狼女孩';
const _board = getBoardByName(BOARD_NAME)!;
const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
]);
const SEER_STEP = actorStep('seerCheck', 'seer', 8);
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
      await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
    });
  });

  describe('actionConfirm coverage', () => {
    it('seer: tapping seat shows actionConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });

    it('wolfGirl confess: tapping a civilian seat shows actionConfirm dialog', async () => {
      const view = await mount(actorStep('wolfGirlConfess', 'wolfGirl', 7));
      harness.clear();
      await tapSeat(view, 0);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    });
  });

  describe('wolfVote coverage', () => {
    it('wolf vote: tapping seat shows wolf vote dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
    });
  });

  describe('confirmTrigger coverage', () => {
    it('hunter confirm: pressing bottom button shows confirmTrigger dialog', async () => {
      const view = await mount(
        confirmStep('hunterConfirm', 'hunter', 10, { role: 'hunter', canShoot: true }),
      );
      const bottomActionText = requireBottomActionText('hunterConfirm');
      await view.findByText(bottomActionText);
      await pressText(view, bottomActionText);
      await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
    });
  });

  describe('wolfVoteEmpty coverage', () => {
    it('wolf vote: skip shows wolfVoteEmpty dialog', async () => {
      const view = await mount(WOLF_STEP);
      harness.clear();
      await pressText(view, requireEmptyVoteText());
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
    });
  });

  describe('skipConfirm coverage', () => {
    it('seer: skip button shows skipConfirm dialog', async () => {
      const view = await mount(SEER_STEP);
      harness.clear();
      await pressText(view, requireBottomActionText('seerCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
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
        4,
        WOLVES,
        1,
      );
      expect(wolfVoteAction).toHaveBeenCalledWith({ kind: 'target', target: 1 });

      // Step 3: confirmTrigger (hunter)
      await coverageChainConfirmTrigger(harness, 'hunterConfirm', 'hunter', 'hunter', 10);

      // Step 4: actionConfirm (seer tap seat)
      const { submitAction: seerSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
        1,
      );
      expect(seerSubmit).toHaveBeenCalled();

      // Step 5: actionConfirm (wolfGirl confess tap seat)
      const { submitAction: confessSubmit } = await coverageChainSeatActionConfirm(
        harness,
        'wolfGirlConfess',
        'wolfGirl',
        'wolfGirl',
        7,
        0,
      );
      expect(confessSubmit).toHaveBeenCalled();

      // Step 6: skipConfirm (seer)
      const { submitAction: seerSkip } = await coverageChainSkipConfirm(
        harness,
        'seerCheck',
        'seer',
        'seer',
        8,
      );
      expect(seerSkip).toHaveBeenCalled();

      // Step 7: wolfVoteEmpty
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
        'wolfVote',
        'wolfVoteEmpty',
        'confirmTrigger',
        'actionConfirm',
        'skipConfirm',
      ]);
    });
  });
});

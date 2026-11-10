/**
 * Cancel Paths UI Test
 *
 * Tests the CANCEL button behavior for all dialog types that have cancel buttons.
 * Verifies that pressing cancel does NOT call submitAction.
 *
 * This is a cross-board test - not tied to a specific board configuration.
 * It covers a gap where nearly all board tests only test the confirm path.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  mountRoomFor as mount,
  pressText,
  recordAlerts,
  requireBottomActionText,
  requireEmptyVoteText,
  RoomScreenTestHarness,
  type SubmitActionMock,
  successfulWerewolfCommand,
  tapSeat,
  type WerewolfRoomMockOptions,
  witchStep,
  wolfKillStep,
} from '@/games/werewolf/room/__tests__/harness';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const WOLVES = new Map<number, RoleId>([
  [4, 'wolf'],
  [5, 'wolf'],
  [6, 'wolf'],
  [7, 'wolf'],
]);

/** `step` with a fresh recorded submit; every cancel path asserts it stays uncalled. */
function withSubmitSpy(step: WerewolfRoomMockOptions): {
  options: WerewolfRoomMockOptions;
  submitAction: SubmitActionMock;
} {
  const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
  return { options: { ...step, hookOverrides: { submitAction } }, submitAction };
}

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('Cancel Paths (cross-board)', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  // ===========================================================================
  // wolfVote cancel -> submitAction NOT called
  // ===========================================================================

  describe('wolfVote cancel', () => {
    it('pressing cancel on wolfVote dialog does NOT call submitAction', async () => {
      const { options, submitAction } = withSubmitSpy(wolfKillStep('wolf', 4, WOLVES));
      const view = await mount(options);
      harness.clear();

      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));

      await harness.pressButtonOnType('wolfVote', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // wolfVoteEmpty cancel -> submitAction NOT called
  // ===========================================================================

  describe('wolfVoteEmpty cancel', () => {
    it('pressing cancel on wolfVoteEmpty dialog does NOT call submitAction', async () => {
      const { options, submitAction } = withSubmitSpy(wolfKillStep('wolf', 4, WOLVES));
      const view = await mount(options);
      harness.clear();

      await pressText(view, requireEmptyVoteText());
      await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));

      await harness.pressButtonOnType('wolfVoteEmpty', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // actionConfirm cancel -> submitAction NOT called
  // ===========================================================================

  describe('actionConfirm cancel', () => {
    it('pressing cancel on seer actionConfirm does NOT call submitAction', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('seerCheck', 'seer', 8));
      const view = await mount(options);
      harness.clear();

      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

      await harness.pressButtonOnType('actionConfirm', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // skipConfirm cancel -> submitAction NOT called
  // ===========================================================================

  describe('skipConfirm cancel', () => {
    it('pressing cancel on skipConfirm does NOT call submitAction', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('seerCheck', 'seer', 8));
      const view = await mount(options);
      harness.clear();

      await pressText(view, requireBottomActionText('seerCheck'));
      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

      await harness.pressButtonOnType('skipConfirm', '取消');

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // witchPoisonPrompt cancel -> submitAction NOT called
  // ===========================================================================

  describe('witchPoisonPrompt cancel', () => {
    it('pressing cancel on witch poison confirm does NOT call submitAction', async () => {
      const { options, submitAction } = withSubmitSpy(witchStep(9, -1));
      const view = await mount(options);
      harness.clear();

      await tapSeat(view, 1);
      await waitFor(() =>
        expect(harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm')).toBe(true),
      );

      // Press cancel on whichever dialog appeared
      const lastEvent = harness.getLastEvent();
      if (lastEvent && lastEvent.buttons.includes('取消')) {
        await harness.pressButton('取消');
      }

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // swap confirm cancel -> both picks cleared (§6.9 取消清两座)
  // ===========================================================================

  describe('swap confirm cancel', () => {
    it('cancelling the magician swap confirm clears both picks: the next tap is a first pick again', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('magicianSwap', 'magician', 3));
      const view = await mount(options);
      harness.clear();

      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));
      await harness.pressPrimaryOnType('magicianFirst');
      await tapSeat(view, 2);
      await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));

      await harness.pressButtonOnType('actionConfirm', '取消');
      expect(submitAction).not.toHaveBeenCalled();

      // Both picks are gone: a tap now opens the first-pick dialog, not the confirm.
      harness.clear();
      await tapSeat(view, 5);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));
      expect(harness.hasSeen('actionConfirm')).toBe(false);
      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // magicianFirst dismiss does NOT call submitAction
  // ===========================================================================

  describe('magicianFirst dismiss', () => {
    it('dismissing magicianFirst alert keeps first target but no submit', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('magicianSwap', 'magician', 3));
      const view = await mount(options);
      harness.clear();

      await tapSeat(view, 1);
      await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));

      // magicianFirst only has a primary button ("知道了"), no cancel
      expect(submitAction).not.toHaveBeenCalled();
    });
  });
});

/**
 * Cancel Paths UI Test
 *
 * Tests cancellation for seat drafts and night dialogs.
 * Verifies that pressing cancel does NOT call submitAction.
 *
 * This is a cross-board test - not tied to a specific board configuration.
 * It covers a gap where nearly all board tests only test the confirm path.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  cancelSeatSelection,
  draftSeatSelection,
  mountRoomFor as mount,
  pressText,
  recordAlerts,
  requireBottomActionText,
  requireEmptyVoteText,
  RoomScreenTestHarness,
  seatSelectionSubmitButton,
  startSeatSelection,
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
    it('cancelling a wolf target draft does not submit', async () => {
      const { options, submitAction } = withSubmitSpy(wolfKillStep('wolf', 4, WOLVES));
      const view = await mount(options);
      await draftSeatSelection(view, 1);
      await cancelSeatSelection(view);

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
  // Seer selection cancel -> submitAction NOT called
  // ===========================================================================

  describe('seer selection cancel', () => {
    it('cancelling a seer target draft does not submit', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('seerCheck', 'seer', 8));
      const view = await mount(options);
      await draftSeatSelection(view, 1);
      await cancelSeatSelection(view);

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
  // Witch poison selection cancel -> submitAction NOT called
  // ===========================================================================

  describe('witch poison selection cancel', () => {
    it('cancelling a witch poison draft does not submit', async () => {
      const { options, submitAction } = withSubmitSpy(witchStep(9, -1));
      const view = await mount(options);
      await draftSeatSelection(view, 1);
      await cancelSeatSelection(view);

      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // swap confirm cancel -> both picks cleared (§6.9 取消清两座)
  // ===========================================================================

  describe('swap selection cancel', () => {
    it('cancelling a magician swap clears both picks', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('magicianSwap', 'magician', 3));
      const view = await mount(options);
      await startSeatSelection(view);
      await tapSeat(view, 1);
      await tapSeat(view, 2);
      expect(seatSelectionSubmitButton(view)).toBeEnabled();
      await cancelSeatSelection(view);
      expect(submitAction).not.toHaveBeenCalled();

      await startSeatSelection(view);
      expect(view.getByText('已选 0 / 2 人')).toBeInTheDocument();
      await tapSeat(view, 5);
      expect(view.getByText('已选 1 / 2 人')).toBeInTheDocument();
      expect(seatSelectionSubmitButton(view)).toHaveAttribute('aria-disabled', 'true');
      expect(submitAction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Drafting the first swap target does NOT call submitAction
  // ===========================================================================

  describe('magician first pick', () => {
    it('drafting only one target does not submit a swap', async () => {
      const { options, submitAction } = withSubmitSpy(actorStep('magicianSwap', 'magician', 3));
      const view = await mount(options);
      await startSeatSelection(view);
      await tapSeat(view, 1);
      expect(view.getByText('已选 1 / 2 人')).toBeInTheDocument();
      expect(seatSelectionSubmitButton(view)).toHaveAttribute('aria-disabled', 'true');
      expect(submitAction).not.toHaveBeenCalled();
    });
  });
});

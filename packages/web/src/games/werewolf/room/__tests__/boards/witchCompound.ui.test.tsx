/**
 * Witch Compound Sequence UI Test
 *
 * Tests the witch compound action flow as a full sequence:
 * 1. Save prompt appears → press dismiss → no submit
 * 2. Then open poison selection → draft target → submit poison payload
 * 3. Save prompt appears → press dismiss → press skip → skipConfirm → press confirm → submitAction called with skipAll
 *
 * Existing board tests only test each witch dialog type in isolation.
 * This test verifies the sequential compound flow works end-to-end.
 */

import type { CompoundSchema, GameState } from '@game-judge/game-engine/games/werewolf/public';
import { SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  cancelSeatSelection,
  click,
  draftSeatSelection,
  mountRoomFor as mount,
  openNightActionGroup,
  pressText,
  recordAlerts,
  RoomScreenTestHarness,
  seatSelectionSubmitButton,
  startSeatSelection,
  type SubmitActionMock,
  submitSeatSelection,
  successfulWerewolfCommand,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const poisonSkipText =
  (SCHEMAS.witchAction as CompoundSchema).steps?.find((step) => step.key === 'poison')?.ui
    ?.bottomActionText || '不用技能';

function witchWith(
  witchContext: NonNullable<GameState['witchContext']>,
  submitAction: SubmitActionMock,
): WerewolfRoomMockOptions {
  return {
    ...actorStep('witchAction', 'witch', 9),
    witchContext,
    hookOverrides: { submitAction },
  };
}

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('Witch Compound Sequence', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('groups the choices under one pending entry and restores focus when returning', async () => {
    const view = await mount(
      witchWith(
        { killedSeat: 1, canSave: true, canPoison: true },
        vi.fn(async () => successfulWerewolfCommand()),
      ),
    );
    const entry = view.getByRole('button', { name: '女巫行动' });
    expect(entry).toHaveAccessibleDescription('有待处理操作');
    expect(view.queryByRole('button', { name: '对2号用解药' })).not.toBeInTheDocument();

    await click(entry);
    const back = view.getByRole('button', { name: '返回' });
    expect(back).toHaveFocus();
    expect(view.getByRole('button', { name: '对2号用解药' })).not.toHaveAccessibleDescription(
      '有待处理操作',
    );
    expect(view.queryByRole('button', { name: '查看身份' })).not.toBeInTheDocument();
    await startSeatSelection(view);
    expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent('2号被狼人袭击');
    await cancelSeatSelection(view);
    expect(view.getByRole('button', { name: '返回' })).toHaveFocus();
    await click(view.getByRole('button', { name: '返回' }));
    expect(view.getByRole('button', { name: '女巫行动' })).toHaveFocus();
  });

  // ===========================================================================
  // Sequence: save status → draft poison target → submit
  // ===========================================================================

  describe('save status → poison flow', () => {
    it('lets the witch cancel a poison confirmation without submitting', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: 1, canSave: true, canPoison: true }, submitAction),
      );
      await draftSeatSelection(view, 2);
      await click(seatSelectionSubmitButton(view));
      expect(harness.getLastEvent()?.message).toContain('3号');
      expect(submitAction).not.toHaveBeenCalled();
      await harness.pressButton('取消');
      expect(submitAction).not.toHaveBeenCalled();
      await submitSeatSelection(view);
      expect(submitAction).toHaveBeenCalledExactlyOnceWith({
        kind: 'witch',
        saveTarget: null,
        poisonTarget: 2,
      });
    });

    it('shows the save status, then drafts and submits a poison target', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: 1, canSave: true, canPoison: true }, submitAction),
      );

      await waitFor(() => harness.expectInlineStatus('witchSavePrompt'));

      await openNightActionGroup(view);
      const startId = TESTIDS.werewolfNightButton('startSeatSelection');
      expect(view.getByTestId(startId)).toBeVisible();
      harness.clear();
      await draftSeatSelection(view, 2);
      expect(harness.events()).toEqual([]);
      expect(submitAction).not.toHaveBeenCalled();
      await submitSeatSelection(view);
      expect(submitAction).toHaveBeenCalledExactlyOnceWith({
        kind: 'witch',
        saveTarget: null,
        poisonTarget: 2,
      });
    });
  });

  // ===========================================================================
  // Sequence: no-kill status → skip all → skipConfirm → submit
  // ===========================================================================

  describe('no-kill status → skip all flow', () => {
    it('shows no-kill status, then pressing skip triggers skipConfirm', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: -1, canSave: false, canPoison: true }, submitAction),
      );

      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
      await pressText(view, poisonSkipText);

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));

      // Step 4: confirm skip
      await harness.pressPrimaryOnType('skipConfirm');

      // Submit should be called
      expect(submitAction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // canSave=false, canPoison=false → no interaction needed (edge case)
  // ===========================================================================

  describe('no abilities available', () => {
    it('witch with canSave=false canPoison=false can still skip', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: -1, canSave: false, canPoison: false }, submitAction),
      );

      await waitFor(() => harness.expectInlineStatus('witchNoKill'));
      await pressText(view, poisonSkipText);

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
      await harness.pressPrimaryOnType('skipConfirm');
      expect(submitAction).toHaveBeenCalled();
    });
  });
});

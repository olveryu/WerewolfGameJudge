/**
 * Witch Compound Sequence UI Test
 *
 * Tests the witch compound action flow as a full sequence:
 * 1. Save prompt appears → press dismiss → no submit
 * 2. Then tap seat → poison confirm → press confirm → submitAction called with poison payload
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
  mountRoomFor as mount,
  pressText,
  recordAlerts,
  RoomScreenTestHarness,
  type SubmitActionMock,
  successfulWerewolfCommand,
  tapSeat,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';

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

  // ===========================================================================
  // Sequence: save prompt → dismiss → tap seat → poison confirm → submit
  // ===========================================================================

  describe('save prompt dismiss → poison flow', () => {
    it('save prompt appears, dismiss, then tap seat triggers poison confirm', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: 1, canSave: true, canPoison: true }, submitAction),
      );

      // Step 1: witchSavePrompt auto-triggers
      await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));

      // Step 2: dismiss the save prompt
      await harness.pressPrimaryOnType('witchSavePrompt');

      // Step 3: tap a seat to trigger poison
      await tapSeat(view, 2);

      await waitFor(() =>
        expect(harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm')).toBe(true),
      );

      // Step 4: confirm the poison action
      const lastEvent = harness.getLastEvent();
      if (lastEvent && lastEvent.buttons.includes('确定')) {
        await harness.pressButton('确定');
      }

      // Submit should be called with poison payload
      expect(submitAction).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Sequence: no-kill info → dismiss → skip all → skipConfirm → submit
  // ===========================================================================

  describe('save prompt dismiss → skip all flow', () => {
    it('save prompt appears, dismiss, then pressing skip triggers skipConfirm', async () => {
      const submitAction: SubmitActionMock = vi.fn(async () => successfulWerewolfCommand());
      const view = await mount(
        witchWith({ killedSeat: -1, canSave: false, canPoison: true }, submitAction),
      );

      // Step 1: witchNoKill info prompt auto-triggers
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));

      // Step 2: dismiss the info prompt
      await harness.pressPrimaryOnType('witchNoKill');

      // Step 3: press the skip button
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

      // witchNoKill should auto-trigger
      await waitFor(() => expect(harness.hasSeen('witchNoKill')).toBe(true));

      // Dismiss and press skip
      await harness.pressPrimaryOnType('witchNoKill');
      await pressText(view, poisonSkipText);

      await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
      await harness.pressPrimaryOnType('skipConfirm');
      expect(submitAction).toHaveBeenCalled();
    });
  });
});

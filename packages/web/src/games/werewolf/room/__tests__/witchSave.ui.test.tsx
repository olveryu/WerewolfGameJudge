/**
 * Witch Save UI Test (Night-1)
 *
 * Locks the contract:
 * - save step is confirmTarget (no seat tapping to select target)
 * - save action uses killedSeat from witchContext
 * - when canSave=false, save should not submit
 * - protocol: submitAction({ kind: 'witch', saveTarget, poisonTarget })
 */

import type {
  CompoundSchema,
  WerewolfActionInput,
} from '@game-judge/game-engine/games/werewolf/public';
import { SCHEMAS } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { waitFor } from '@testing-library/react';

import {
  actorStep,
  mountRoomFor,
  pressText,
  recordAlerts,
  RoomScreenTestHarness,
  type SubmitActionMock,
  successfulWerewolfCommand,
  tapSeat,
} from '@/games/werewolf/room/__tests__/harness';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));

let submitAction: SubmitActionMock;
let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

/** The witch on seat 0; `gameState.witchContext` is the server fact the night model reads. */
const mountWitch = (overrides?: { canSave?: boolean; killedSeat?: number }) =>
  mountRoomFor({
    ...actorStep('witchAction', 'witch', 0),
    witchContext: {
      killedSeat: overrides?.killedSeat ?? 2,
      canSave: overrides?.canSave ?? true,
      canPoison: true,
    },
    hookOverrides: { submitAction },
  });

describe('WerewolfRoomScreen witch save UI (contract)', () => {
  beforeEach(() => {
    submitAction = vi.fn(async (_input: WerewolfActionInput) => successfulWerewolfCommand());
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  it('seat tapping does NOT submit save (save is confirmTarget, target comes from witchContext)', async () => {
    const view = await mountWitch();

    // Even if user taps some seat, save step should NOT be driven by seat taps.
    await tapSeat(view, 5);

    expect(submitAction).not.toHaveBeenCalled();
  });

  it('canSave=false should not submit save (guardrail contract)', async () => {
    const view = await mountWitch({ canSave: false, killedSeat: 2 });

    // There is no seat-driven save; ensure we still didn't submit mistakenly.
    await tapSeat(view, 2);
    expect(submitAction).not.toHaveBeenCalled();
  });

  it('save button -> confirm -> submits canonical witch input', async () => {
    // killedSeat = 2, mySeat = 0
    const killedSeat = 2;
    const view = await mountWitch({ canSave: true, killedSeat });
    harness.clear();

    // Click the save button (bottom action button)
    await pressText(view, `对${formatSeat(killedSeat)}用解药`);

    // Confirm dialog should appear with a 确定 button
    await waitFor(() => {
      const confirm = harness
        .events()
        .find((event) => event.title === '确认行动' || event.buttons.includes('确定'));
      expect(confirm).toBeDefined();
    });
    const confirm = harness
      .events()
      .find((event) => event.title === '确认行动' || event.buttons.includes('确定'))!;
    await harness.pressButtonOnType(confirm.type, '确定');

    expect(submitAction).toHaveBeenCalledWith({
      kind: 'witch',
      saveTarget: killedSeat,
      poisonTarget: null,
    });
  });

  it('canSave=true with killedSeat>=0 shows promptTemplate from schema', async () => {
    const killedSeat = 2;
    const view = await mountWitch({ canSave: true, killedSeat });

    const saveStep = (SCHEMAS.witchAction as CompoundSchema).steps[0]!;
    const expectedPrompt = saveStep.ui?.promptTemplate?.replace('{seat}', formatSeat(killedSeat));

    await waitFor(() => {
      expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(expectedPrompt!);
      expect(harness.events()).toEqual([]);
    });
  });

  it('canSave=false with killedSeat>=0 shows cannotSavePrompt from schema (witch self-kill)', async () => {
    // Witch is at seat 0, wolves kill seat 0 → canSave=false, killedSeat=0
    const view = await mountWitch({ canSave: false, killedSeat: 0 });

    const saveStep = (SCHEMAS.witchAction as CompoundSchema).steps[0]!;
    const expectedPrompt = saveStep.ui?.cannotSavePrompt;

    await waitFor(() => {
      expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(expectedPrompt!);
      expect(harness.events()).toEqual([]);
    });
  });

  it.each([
    [false, '你被狼人袭击，本局规则不允许自救。'],
    [true, '你被狼人袭击，可以使用解药自救。'],
  ])(
    'shows the self-attack message without a dialog when canSave is %s',
    async (canSave, message) => {
      const view = await mountWitch({ canSave, killedSeat: 0 });
      expect(harness.events()).toEqual([]);
      expect(view.getByTestId(TESTIDS.actionMessage)).toHaveTextContent(message);
      expect(view.getByTestId(TESTIDS.actionMessage)).toBeVisible();
    },
  );
});

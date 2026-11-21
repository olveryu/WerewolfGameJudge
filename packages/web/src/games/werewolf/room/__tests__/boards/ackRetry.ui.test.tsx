/**
 * Reveal acknowledgements retry from the original dialog after a toast.
 * Seat submissions report delivery failures and retry from the retained draft.
 */

import type { GameState, WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import { act, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import {
  cancelSeatSelection,
  createWerewolfRoomMock,
  draftSeatSelection,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
  type SubmitActionMock,
  type WerewolfDispatchOutcome,
} from '@/games/werewolf/room/__tests__/harness';
import { rejectedRoomCommand, undeliveredRoomCommand } from '@/test-utils/roomCommand';

vi.mock('@/contexts/AuthContext', () => import('../harness/testAuthContext'));

const SEER_SEAT = 8;

let harness: RoomScreenTestHarness;
let detachAlerts: () => void;

describe('night dialog retry on transport failure', () => {
  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
    vi.spyOn(toast, 'error');
  });
  afterEach(() => {
    detachAlerts();
    vi.restoreAllMocks();
  });

  it('reveal ack: an undelivered ack toasts, rejects the dialog callback and shows no second alert', async () => {
    const mock = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'seer',
      mySeat: SEER_SEAT,
      seerReveal: { targetSeat: 1, result: '好人' },
      gameStateOverrides: {
        pendingRevealAcks: ['seerCheck'],
        actions: [{ schemaId: 'seerCheck', actorSeat: SEER_SEAT, targetSeat: 1, timestamp: 1 }],
      },
      hookOverrides: {
        dispatchCommand: async (command) => {
          if (command.type !== 'werewolf.reveal.ack') {
            throw new Error(`[TEST] unexpected command ${command.type}`);
          }
          return undeliveredRoomCommand<GameState>('network', 'reveal-ack');
        },
      },
    });

    await mountWerewolfRoom(mock);
    await waitFor(() => expect(harness.hasSeen('seerReveal')).toBe(true));
    const eventsBefore = harness.events().length;

    await expect(harness.pressAndSettle('seerReveal')).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    // The reveal dialog was not replaced by an error alert.
    expect(harness.events()).toHaveLength(eventsBefore);
    expect(mock.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.reveal.ack' },
      expect.objectContaining({ controlledSeat: null }),
    );
  });

  it('seat submission keeps the draft on delivery failure and reports a rejected retry', async () => {
    const outcomes: WerewolfDispatchOutcome[] = [
      undeliveredRoomCommand<GameState>('network', 'a1'),
      rejectedRoomCommand<GameState>('invalid_status', 'a2'),
    ];
    const submitAction: SubmitActionMock = vi.fn(async (_input: WerewolfActionInput) => {
      const next = outcomes.shift();
      if (next === undefined) throw new Error('[TEST] no outcome scripted');
      return next;
    });
    const view = await mountWerewolfRoom(
      createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeat: SEER_SEAT,
        hookOverrides: { submitAction },
      }),
    );
    harness.clear();
    await draftSeatSelection(view, 1);
    const eventsBefore = harness.events().length;
    await expect(harness.pressAndSettle('actionConfirm')).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(harness.events()).toHaveLength(eventsBefore);
    expect(toast.error).toHaveBeenCalledOnce();
    expect(harness.getLastEvent()?.message).toContain('2号');

    await harness.pressAndSettle('actionConfirm');
    await waitFor(() => expect(harness.events()).toHaveLength(eventsBefore + 1));
    expect(harness.events().at(-1)?.title).toBe('操作失败');
    expect(submitAction).toHaveBeenCalledTimes(2);
    expect(submitAction).toHaveBeenNthCalledWith(1, { kind: 'target', target: 1 });
    expect(submitAction).toHaveBeenNthCalledWith(2, { kind: 'target', target: 1 });
  });

  it('returns to the main hand after a pending seat submission fails', async () => {
    let releaseSubmission: (() => void) | undefined;
    const submission = new Promise<void>((resolve) => {
      releaseSubmission = resolve;
    });
    const submitAction: SubmitActionMock = vi.fn(async () => {
      await submission;
      return undeliveredRoomCommand<GameState>('network', 'pending');
    });
    const view = await mountWerewolfRoom(
      createWerewolfRoomMock({
        schemaId: 'seerCheck',
        currentActionRole: 'seer',
        myRole: 'seer',
        mySeat: SEER_SEAT,
        hookOverrides: { submitAction },
      }),
    );
    harness.clear();
    await draftSeatSelection(view, 1);
    const pending = harness.pressAndSettle('actionConfirm');
    await waitFor(() => expect(submitAction).toHaveBeenCalledOnce());
    await act(async () => {
      if (releaseSubmission === undefined) throw new Error('[TEST] submission was not initialized');
      releaseSubmission();
      await submission;
    });
    await expect(pending).rejects.toMatchObject({ name: 'RoomCommandUndeliveredError' });
    await harness.pressButton('取消');
    await cancelSeatSelection(view);
    expect(view.getByRole('group', { name: '行动手牌' })).toBeVisible();
    expect(view.getByRole('button', { name: '预言家行动' })).toBeVisible();
    expect(view.queryByRole('button', { name: '不用技能' })).not.toBeInTheDocument();
  });
});

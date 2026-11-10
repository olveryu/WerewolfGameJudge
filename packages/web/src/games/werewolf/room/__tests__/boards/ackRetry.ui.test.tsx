/**
 * §6.9 — a night dialog whose submit fails in transport stays open for retry:
 * the dialog callback rejects (the AlertHost protocol for "keep the dialog"),
 * the failure is a toast — never a modal alert that would replace the dialog —
 * and a decision (rejection) still closes the dialog with the usual alert.
 */

import type { GameState, WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import { waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import {
  createWerewolfRoomMock,
  mountWerewolfRoom,
  recordAlerts,
  RoomScreenTestHarness,
  type SubmitActionMock,
  tapSeat,
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

  it('action confirm: an undelivered submit keeps the confirm dialog; a rejection closes it with an alert', async () => {
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
    await tapSeat(view, 1);
    await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    const eventsBefore = harness.events().length;

    // Transport failure: toast + rejected callback → the dialog stays for retry.
    await expect(harness.pressAndSettle('actionConfirm', '确定')).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    expect(harness.events()).toHaveLength(eventsBefore);

    // Retry answered by a decision: the callback resolves (dialog closes) and the rejection alerts.
    await expect(harness.pressAndSettle('actionConfirm', '确定')).resolves.toBeUndefined();
    await waitFor(() => expect(harness.events().length).toBe(eventsBefore + 1));
    expect(harness.events().at(-1)?.title).toBe('操作失败');
    expect(submitAction).toHaveBeenCalledTimes(2);
  });
});

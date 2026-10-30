/**
 * §6.9 — a night dialog whose submit fails in transport stays open for retry:
 * the dialog callback rejects (the AlertModal protocol for "keep the dialog"),
 * the failure is a toast — never a modal alert that would replace the dialog —
 * and a decision (rejection) still closes the dialog with the usual alert.
 */

import type { GameState, WerewolfActionInput } from '@game-judge/game-engine/games/werewolf/public';
import { render, waitFor } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import {
  createShowAlertMock,
  createWerewolfRoomMock,
  mockNavigation,
  mockRoom,
  RoomScreenTestHarness,
  type SubmitActionMock,
  tapSeat,
  waitForRoomScreen,
  type WerewolfDispatchOutcome,
} from '@/games/werewolf/room/__tests__/harness';
import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { rejectedRoomCommand, undeliveredRoomCommand } from '@/test-utils/roomCommand';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

let harness: RoomScreenTestHarness;
let mockUseWerewolfRoomReturn: ReturnType<typeof createWerewolfRoomMock>;

jest.mock('@/games/werewolf/room/__tests__/harness/activeRoomMock', () => ({
  getActiveRoomMock: () => mockUseWerewolfRoomReturn,
}));

const SEER_SEAT = 8;

describe('night dialog retry on transport failure', () => {
  const renderRoom = () =>
    render(<WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />);

  beforeEach(() => {
    jest.clearAllMocks();
    harness = new RoomScreenTestHarness();
    jest.mocked(showAlert).mockImplementation(createShowAlertMock(harness));
  });

  it('reveal ack: an undelivered ack toasts, rejects the dialog callback and shows no second alert', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
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
        dispatchCommand: async (command) =>
          command.type === 'werewolf.reveal.ack'
            ? undeliveredRoomCommand<GameState>('network', 'reveal-ack')
            : (() => {
                throw new Error(`[TEST] unexpected command ${command.type}`);
              })(),
      },
    });

    const { getByTestId } = renderRoom();
    await waitForRoomScreen(getByTestId);
    await waitFor(() => expect(harness.hasSeen('seerReveal')).toBe(true));
    const eventsBefore = harness.events().length;

    await expect(harness.pressAndSettle('seerReveal')).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(jest.mocked(toast.error)).toHaveBeenCalledTimes(1);
    // The reveal dialog was not replaced by an error alert.
    expect(harness.events()).toHaveLength(eventsBefore);
    expect(mockUseWerewolfRoomReturn.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.reveal.ack' },
      expect.objectContaining({ controlledSeat: null }),
    );
  });

  it('action confirm: an undelivered submit keeps the confirm dialog; a rejection closes it with an alert', async () => {
    const outcomes: WerewolfDispatchOutcome[] = [
      undeliveredRoomCommand<GameState>('network', 'a1'),
      rejectedRoomCommand<GameState>('invalid_status', 'a2'),
    ];
    const submitAction: SubmitActionMock = jest.fn(async (_input: WerewolfActionInput) => {
      const next = outcomes.shift();
      if (next === undefined) throw new Error('[TEST] no outcome scripted');
      return next;
    });
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'seer',
      mySeat: SEER_SEAT,
      hookOverrides: { submitAction },
    });

    const { getByTestId } = renderRoom();
    await waitForRoomScreen(getByTestId);
    harness.clear();
    tapSeat(getByTestId, 1);
    await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
    const eventsBefore = harness.events().length;

    // Transport failure: toast + rejected callback → the dialog stays for retry.
    await expect(harness.pressAndSettle('actionConfirm', '确定')).rejects.toMatchObject({
      name: 'RoomCommandUndeliveredError',
    });
    expect(jest.mocked(toast.error)).toHaveBeenCalledTimes(1);
    expect(harness.events()).toHaveLength(eventsBefore);

    // Retry answered by a decision: the callback resolves (dialog closes) and the rejection alerts.
    await expect(harness.pressAndSettle('actionConfirm', '确定')).resolves.toBeUndefined();
    await waitFor(() => expect(harness.events().length).toBe(eventsBefore + 1));
    expect(harness.events().at(-1)?.title).toBe('操作失败');
    expect(submitAction).toHaveBeenCalledTimes(2);
  });
});

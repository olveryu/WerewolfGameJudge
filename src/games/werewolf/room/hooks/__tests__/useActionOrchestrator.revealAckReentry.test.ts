/**
 * useActionOrchestrator reveal-ack re-entry — behavior tests.
 *
 * Pins the state-driven re-presentation of the reveal dialog after a
 * full-page reload: the outcome snapshot is gone, but the ack is still
 * pending in room state (pendingRevealAcks + the recorded action), so a
 * fresh mount must re-present the same dialog for the actor who owes the
 * ack — and only for that actor. Also pins the cross-path guard: the
 * outcome path (revealExecutor) and the re-entry effect share one claim
 * per ack episode, so the dialog is presented at most once.
 *
 * Params are assembled exactly as production does: the raw GameState goes
 * through derivePendingRevealAck (useWerewolfRoom) and
 * toWerewolfLocalState before reaching the hook.
 */
import type { GameState, ProtocolAction } from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  getSchema,
  getWerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { derivePendingRevealAck } from '@/games/werewolf/room/policy/pendingRevealAck';
import type { UseRoomActionDialogsResult } from '@/games/werewolf/room/useRoomActionDialogs';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { useActionOrchestrator } from '../useActionOrchestrator';

type ConfirmCallback = () => void | Promise<void>;
type RevealCallback = () => void | Promise<void>;
type OrchestratorParams = Parameters<typeof useActionOrchestrator>[0];

function action(schemaId: ProtocolAction['schemaId'], actorSeat: number): ProtocolAction {
  return { schemaId, actorSeat, targetSeat: 3, timestamp: 1_700_000_000_000 };
}

/** State as broadcast after my seer check committed: reveal data + pending ack. */
function buildPendingState(actorSeat: number): GameState {
  return buildWerewolfTestState({
    status: GameStatus.Ongoing,
    actions: [action('seerCheck', actorSeat)],
    pendingRevealAcks: ['seerCheck'],
    seerReveal: { targetSeat: 3, result: '好人' },
  });
}

function createHarness() {
  let confirmCallback: ConfirmCallback | null = null;
  const revealCallbacks: RevealCallback[] = [];
  const dialogs = {
    showActionRejectedAlert: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showRevealDialog: jest.fn((_title: string, _message: string, callback: RevealCallback) => {
      revealCallbacks.push(callback);
    }),
    showConfirmDialog: jest.fn((_title: string, _message: string, callback: ConfirmCallback) => {
      confirmCallback = callback;
    }),
    showWolfVoteDialog: jest.fn(),
    showWitchInfoPrompt: jest.fn(),
    showRoleActionPrompt: jest.fn(),
  } satisfies UseRoomActionDialogsResult;
  return {
    dialogs,
    revealCallbacks,
    requireConfirmCallback: (): ConfirmCallback => {
      if (confirmCallback === null) {
        throw new Error('[TEST] Confirmation callback was not registered');
      }
      return confirmCallback;
    },
    requireRevealCallback: (index: number): RevealCallback => {
      const callback = revealCallbacks[index];
      if (callback === undefined) {
        throw new Error(`[TEST] Reveal callback ${index} was not registered`);
      }
      return callback;
    },
  };
}

function createParams(state: GameState, dialogs: UseRoomActionDialogsResult) {
  return {
    gameState: toWerewolfLocalState(state),
    viewModel: getWerewolfViewModel(state, { seat: 0, isHost: false }),
    roomStatus: GameStatus.Ongoing,
    currentActionRole: 'seer' as const,
    currentSchema: getSchema('seerCheck'),
    pendingRevealAck: derivePendingRevealAck(state, 0),
    effectiveSeat: 0,
    effectiveRole: 'seer' as const,
    controlledSeat: null,
    actorSeatForUi: 0,
    imActioner: true,
    isAudioPlaying: false,
    hasPendingActionCommand: false,
    needsContinueOverlay: false,
    firstSwapSeat: null,
    setFirstSwapSeat: jest.fn(),
    setSecondSeat: jest.fn(),
    submitAction: jest.fn(async () => successfulRoomCommand(state)),
    submitRevealAck: jest.fn(async () => successfulRoomCommand(state)),
    sendWolfRobotHunterStatusViewed: jest.fn(async () => successfulRoomCommand(state)),
    submitGroupConfirmAck: jest.fn(async () => successfulRoomCommand(state)),
    multiSelectedSeats: [1, 2],
    setMultiSelectedSeats: jest.fn(),
    getAutoTriggerIntent: () => null,
    actionDialogs: dialogs,
  } satisfies OrchestratorParams;
}

describe('useActionOrchestrator reveal-ack re-entry', () => {
  it('re-presents the reveal dialog on a fresh mount after reload and sends the ack on confirm', async () => {
    const harness = createHarness();
    const pendingState = buildPendingState(0);
    const params = createParams(pendingState, harness.dialogs);

    // Fresh mount, no outcome snapshot: the effect alone must re-present.
    const { rerender } = renderHook((props: OrchestratorParams) => useActionOrchestrator(props), {
      initialProps: params,
    });

    expect(params.submitAction).not.toHaveBeenCalled();
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledWith(
      '查验结果：4号是好人',
      '',
      expect.any(Function),
    );

    // Confirming the re-presented dialog sends the reveal ack.
    await act(async () => {
      await harness.requireRevealCallback(0)();
    });
    expect(params.submitRevealAck).toHaveBeenCalledTimes(1);

    // The acked snapshot clears the pending ack; the guard resets with it.
    const ackedState = buildWerewolfTestState({
      status: GameStatus.Ongoing,
      actions: [action('seerCheck', 0)],
      seerReveal: { targetSeat: 3, result: '好人' },
    });
    rerender(createParams(ackedState, harness.dialogs));
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);

    // A later pending episode (next night) presents again — not stuck.
    rerender(createParams(buildPendingState(0), harness.dialogs));
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(2);
  });

  it('does not present when no reveal ack is pending', () => {
    const harness = createHarness();
    const state = buildWerewolfTestState({
      status: GameStatus.Ongoing,
      seerReveal: { targetSeat: 3, result: '好人' },
    });
    const params = createParams(state, harness.dialogs);

    renderHook(() => useActionOrchestrator(params));

    expect(harness.dialogs.showRevealDialog).not.toHaveBeenCalled();
    expect(params.submitRevealAck).not.toHaveBeenCalled();
  });

  it('does not present when the pending ack belongs to another seat', () => {
    const harness = createHarness();
    const params = createParams(buildPendingState(2), harness.dialogs);

    renderHook(() => useActionOrchestrator(params));

    expect(harness.dialogs.showRevealDialog).not.toHaveBeenCalled();
    expect(params.submitRevealAck).not.toHaveBeenCalled();
  });

  it('presents only once when the outcome path claims the episode before the state broadcast arrives', async () => {
    const harness = createHarness();
    const committedState = buildWerewolfTestState({
      status: GameStatus.Ongoing,
      seerReveal: { targetSeat: 3, result: '好人' },
    });
    const params = createParams(committedState, harness.dialogs);
    const { result, rerender } = renderHook(
      (props: OrchestratorParams) => useActionOrchestrator(props),
      { initialProps: params },
    );

    // Outcome path: confirm the action, dialog comes from the snapshot.
    await act(async () => {
      await result.current.handleActionIntent({
        type: 'reveal',
        targetSeat: 3,
        revealKind: 'seer',
      });
    });
    await act(async () => {
      await harness.requireConfirmCallback()();
    });
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledWith(
      '查验结果：4号是好人',
      '',
      expect.any(Function),
    );

    // The broadcast with the pending ack arrives: the re-entry effect must
    // observe the existing claim and not stack a second dialog.
    rerender(createParams(buildPendingState(0), harness.dialogs));
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);
  });

  it('presents only once when the re-entry effect claims the episode before the outcome path runs', async () => {
    const harness = createHarness();
    const params = createParams(buildPendingState(0), harness.dialogs);
    const { result } = renderHook(() => useActionOrchestrator(params));

    // Re-entry presented on mount and claimed the episode.
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);

    // A late outcome path for the same episode resolves without stacking
    // a second dialog ('alreadyPresented' is not an error).
    await act(async () => {
      await result.current.handleActionIntent({
        type: 'reveal',
        targetSeat: 3,
        revealKind: 'seer',
      });
    });
    await act(async () => {
      await harness.requireConfirmCallback()();
    });
    expect(harness.dialogs.showRevealDialog).toHaveBeenCalledTimes(1);
  });
});

/** Collection recovery contracts with public engine transitions and controlled transport failures. */

import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomSessionSnapshot } from '@/features/room/session/types';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { handleError } from '@/utils/errorPipeline';

import {
  type PictionaryTaskInput,
  usePictionaryAutoSubmission,
} from '../usePictionaryAutoSubmission';
jest.mock('@/games/pictionary/services/renderPictionaryDrawing', () => ({
  renderPictionaryDrawing: jest.fn(),
}));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

function createCollection() {
  let sequence = 0;
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4, guessDurationSeconds: null },
    { roomCode: '2468', hostUserId: 'user-0', nowMs: 1_000, commandId: 'create' },
  );
  const dispatchEngine = (command: PictionaryCommandInput, userId = 'user-0') => {
    sequence += 1;
    const seat =
      Object.values(state.realSeats).find((occupant) => occupant?.userId === userId)?.seat ?? 0;
    const decision = decidePictionaryCommand(state, createPictionaryCommand(state, command, seat), {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 2_000 + sequence,
      commandId: `command-${sequence}`,
      randomSeed: 'recovery',
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
  };
  for (let seat = 0; seat < 4; seat += 1) {
    dispatchEngine(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家${seat}` } },
      `user-${seat}`,
    );
  }
  dispatchEngine({ type: 'pictionary.round.start' });
  dispatchEngine({ type: 'pictionary.phase.finish' });
  const collection = state;
  let snapshot: Extract<RoomSessionSnapshot<PictionaryState>, { phase: 'ready' }> = {
    phase: 'ready',
    epoch: 1,
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    lastCommand: null,
    error: null,
    identity: {
      userId: 'user-0',
      room: {
        roomCode: '2468',
        roomId: 'room-id',
        gameType: 'pictionary',
        hostUserId: 'user-0',
        createdAt: new Date(),
      },
    },
    snapshot: createRoomSnapshot(state, sequence),
  };
  const listeners = new Set<() => void>();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const acknowledge = (command: PictionaryPublicCommand) => {
    dispatchEngine(command);
    snapshot = { ...snapshot, snapshot: createRoomSnapshot(state, sequence) };
    publish();
    return {
      kind: 'decided' as const,
      decision: {
        kind: 'committed' as const,
        commandId: `command-${sequence}`,
        snapshot: snapshot.snapshot,
        outcome: { kind: 'success' as const },
      },
    };
  };
  const dispatch = jest.fn<
    ReturnType<PictionaryRoomSession['dispatch']>,
    Parameters<PictionaryRoomSession['dispatch']>
  >(async (command) => acknowledge(command));
  const session = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
  } as unknown as PictionaryRoomSession;
  const setConnection = (connection: typeof snapshot.connection) => {
    snapshot = { ...snapshot, connection };
    publish();
  };
  const inputs = new Map<number, PictionaryTaskInput>([[0, ' 还没写完\n']]);
  return { collection, session, dispatch, acknowledge, setConnection, inputs };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

it('retains raw text through a transient failure and automatically retries', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('retrying');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(2);
  expect(fixture.dispatch).toHaveBeenLastCalledWith(
    createPictionaryCommand(
      fixture.collection,
      { type: 'pictionary.text.submit', text: ' 还没写完\n' },
      0,
    ),
    expect.objectContaining({ isRecoverable: true }),
  );
  expect(result.current.status).toBe('waiting');
  expect(handleError).not.toHaveBeenCalled();
});

it('resumes on an authoritative live connection without a manual retry', async () => {
  const fixture = createCollection();
  fixture.setConnection('disconnected');
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  expect(result.current.status).toBe('retrying');
  expect(fixture.dispatch).not.toHaveBeenCalled();
  await act(async () => {
    fixture.setConnection('live');
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('waiting');
});

it('accepts a snapshot acknowledgement when the successful HTTP response is lost', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockImplementationOnce(async (command) => {
    fixture.acknowledge(command);
    throw new TypeError('Failed to fetch');
  });
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.status).toBe('waiting');
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(handleError).not.toHaveBeenCalled();
});

it('reports an explicit domain rejection without retrying indefinitely', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockResolvedValueOnce({
    kind: 'decided',
    decision: {
      kind: 'rejected',
      commandId: 'rejected',
      reason: 'pictionary_text_invalid',
    },
  });
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.status).toBe('failed');
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(handleError).toHaveBeenCalledTimes(1);
});

it('automatically submits an empty input', async () => {
  const fixture = createCollection();
  fixture.inputs.set(0, '');
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(fixture.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'pictionary.task.empty.submit' }),
    expect.objectContaining({ isRecoverable: true }),
  );
  expect(result.current.status).toBe('waiting');
});

it('waits for reconnection and retries automatic blank delivery after a network failure', async () => {
  const fixture = createCollection();
  fixture.inputs.clear();
  fixture.setConnection('disconnected');
  fixture.dispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  expect(fixture.dispatch).not.toHaveBeenCalled();
  await act(async () => {
    fixture.setConnection('live');
  });
  expect(result.current.status).toBe('retrying');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(2);
  expect(fixture.dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'pictionary.task.empty.submit' }),
    expect.objectContaining({ isRecoverable: true }),
  );
  expect(result.current.status).toBe('waiting');
  expect(handleError).not.toHaveBeenCalled();
});

it('automatically submits blank when a fresh page has no input', async () => {
  const fixture = createCollection();
  fixture.inputs.clear();
  const { result } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('waiting');
  expect(fixture.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'pictionary.task.empty.submit',
      stepIndex: 0,
    }),
    expect.anything(),
  );
});

it('cancels scheduled delivery when the collection owner unmounts', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { unmount } = renderHook(() =>
    usePictionaryAutoSubmission(fixture.collection, 'user-0', fixture.session, fixture.inputs),
  );
  await act(async () => {
    await Promise.resolve();
  });
  unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
});

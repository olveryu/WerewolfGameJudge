/** Collection recovery contracts with public engine transitions and controlled transport failures. */

import {
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  pictionaryEngine,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomSessionSnapshot } from '@/features/room/session/types';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { pictionaryTextDraftStore } from '@/games/pictionary/services/PictionaryTextDraftStore';
import { handleError } from '@/utils/errorPipeline';

import { usePictionaryDraftFinalizer } from '../usePictionaryDraftFinalizer';

jest.mock('@/games/pictionary/services/PictionaryTextDraftStore', () => ({
  pictionaryTextDraftStore: { read: jest.fn(), clear: jest.fn() },
}));
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
  const dispatchEngine = (command: PictionaryPublicCommand, userId = 'user-0') => {
    sequence += 1;
    const decision = decidePictionaryCommand(state, command, {
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
  return { collection, session, dispatch, acknowledge, setConnection };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(pictionaryTextDraftStore.read).mockReturnValue(' 还没写完\n');
});
afterEach(() => jest.useRealTimers());

it('retains raw text through a transient failure and automatically retries', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { result } = renderHook(() =>
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('retrying');
  expect(pictionaryTextDraftStore.clear).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(2);
  expect(fixture.dispatch).toHaveBeenLastCalledWith(
    { type: 'pictionary.text.submit', text: ' 还没写完\n' },
    expect.objectContaining({ isRecoverable: true }),
  );
  expect(result.current.status).toBe('waiting');
  expect(pictionaryTextDraftStore.clear).toHaveBeenCalled();
  expect(handleError).not.toHaveBeenCalled();
});

it('resumes on an authoritative live connection without a manual retry', async () => {
  const fixture = createCollection();
  fixture.setConnection('disconnected');
  const { result } = renderHook(() =>
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
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
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.status).toBe('waiting');
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(pictionaryTextDraftStore.clear).toHaveBeenCalled();
  expect(handleError).not.toHaveBeenCalled();
});

it('retains drafts and stops automatic retries after an explicit domain rejection', async () => {
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
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.status).toBe('failed');
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(pictionaryTextDraftStore.clear).not.toHaveBeenCalled();
  expect(handleError).toHaveBeenCalledTimes(1);
});

it('requires explicit empty confirmation instead of treating absent drafts as upload failures', async () => {
  const fixture = createCollection();
  jest.mocked(pictionaryTextDraftStore.read).mockReturnValue(null);
  const { result } = renderHook(() =>
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('empty');
  expect(fixture.dispatch).not.toHaveBeenCalled();
  await act(async () => {
    result.current.submitEmpty();
  });
  expect(fixture.dispatch).toHaveBeenCalledWith(
    { type: 'pictionary.task.empty.submit' },
    expect.objectContaining({ isRecoverable: true }),
  );
  expect(result.current.status).toBe('waiting');
});

it('cancels scheduled delivery when the collection owner unmounts', async () => {
  const fixture = createCollection();
  fixture.dispatch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const { unmount } = renderHook(() =>
    usePictionaryDraftFinalizer(fixture.collection, 'user-0', fixture.session),
  );
  await act(async () => {
    await Promise.resolve();
  });
  unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(pictionaryTextDraftStore.clear).not.toHaveBeenCalled();
});

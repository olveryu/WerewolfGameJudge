/** Public-engine collection tests cover all owned bots, unknown delivery and skipped draft retention. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { RoomSessionSnapshot } from '@/features/room/session/types';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import {
  getStoryRelayOwnedTasks,
  storyRelayDraftKey,
  storyRelayDrafts,
} from '@/games/storyrelay/services/storyRelayDrafts';
import { storage } from '@/services/infra/localStorage';

import { useStoryRelayDraftFinalizer } from '../useStoryRelayDraftFinalizer';

jest.mock('@/services/infra/localStorage', () => ({
  storage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

function createCollection() {
  let sequence = 0;
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '2468', hostUserId: 'host', commandId: 'create', nowMs: 1000 },
  );
  const execute = (command: StoryRelayCommand, controlledSeat: number | null = null) => {
    const decision = storyRelayEngine.decide(state, command, {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat,
      nowMs: 1000,
      commandId: `command-${sequence++}`,
      randomSeed: 'round',
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    state = storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state));
  };
  execute({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  execute({ type: 'room.seat.fillBots' });
  execute({ type: 'storyrelay.round.start' });
  execute({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision });
  let snapshot: Extract<RoomSessionSnapshot<StoryRelayState>, { phase: 'ready' }> = {
    phase: 'ready',
    epoch: 1,
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    lastCommand: null,
    error: null,
    identity: {
      userId: 'host',
      room: {
        roomId: 'room-id',
        roomCode: '2468',
        gameType: 'storyrelay',
        hostUserId: 'host',
        createdAt: new Date(),
      },
    },
    snapshot: createRoomSnapshot(state, sequence),
  };
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...snapshot, snapshot: createRoomSnapshot(state, sequence) };
    for (const listener of listeners) listener();
  };
  const acknowledge = (command: StoryRelayCommand, controlledSeat: number | null) => {
    execute(command, controlledSeat);
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
    ReturnType<StoryRelayRoomSession['dispatch']>,
    Parameters<StoryRelayRoomSession['dispatch']>
  >(async (command, options) => acknowledge(command, options.controlledSeat));
  const session = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch,
  } as unknown as StoryRelayRoomSession;
  const tasks = getStoryRelayOwnedTasks(state, 'host');
  const key = (seat: number, roomId = 'room-id') => {
    const task = tasks.find((task) => task.authorSeat === seat);
    if (task === undefined) throw new Error('Missing task');
    return storyRelayDraftKey(roomId, 'host', task);
  };
  return {
    session,
    dispatch,
    acknowledge,
    tasks,
    key,
    publish,
    execute,
    pending(count: number) {
      snapshot = { ...snapshot, pendingCommandCount: count };
      publish();
    },
    mount() {
      return renderHook(() => {
        const current = useRoomSessionSnapshot(session);
        if (current.phase !== 'ready') throw new Error('Not ready');
        return useStoryRelayDraftFinalizer(current.snapshot.state, 'room-id', 'host', session);
      });
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const values = new Map<string, string>();
  jest.mocked(storage.getString).mockImplementation((key) => values.get(key));
  jest.mocked(storage.set).mockImplementation((key, value) => {
    if (typeof value !== 'string') throw new Error('Expected text');
    values.set(key, value);
  });
  jest.mocked(storage.remove).mockImplementation((key) => values.delete(key));
});

it('submits every owned manuscript, preserves whitespace and clears even the final transition receipt', async () => {
  const fixture = createCollection();
  for (let seat = 0; seat < 4; seat += 1)
    storyRelayDrafts.write(fixture.key(seat), ` 原稿 ${seat}\n`);
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(4);
  expect(fixture.session.getSnapshot()).toMatchObject({
    snapshot: { state: { phase: 'transition' } },
  });
  for (let seat = 0; seat < 4; seat += 1)
    expect(storyRelayDrafts.read(fixture.key(seat))).toBeNull();
});

it('does not turn a missing device draft into an empty submission or read another room instance', async () => {
  const fixture = createCollection();
  storyRelayDrafts.write(fixture.key(0, 'older-room'), 'older');
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.dispatch).not.toHaveBeenCalled();
  expect(storyRelayDrafts.read(fixture.key(0, 'older-room'))).toBe('older');
});

it('waits for the shared pending command to settle without creating a second delivery', async () => {
  const fixture = createCollection();
  storyRelayDrafts.write(fixture.key(0), '待确认原文');
  fixture.dispatch.mockImplementationOnce(async () => {
    fixture.pending(1);
    return { kind: 'deliveryUnknown', commandId: 'pending', reason: 'NETWORK_ERROR' };
  });
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
    fixture.publish();
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(storyRelayDrafts.read(fixture.key(0))).toBe('待确认原文');
  await act(async () => {
    fixture.acknowledge(fixture.dispatch.mock.calls[0]![0], null);
    fixture.pending(0);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
  expect(storyRelayDrafts.read(fixture.key(0))).toBeNull();
});

it('retains a manuscript when a confirmed host skip wins the race', async () => {
  const fixture = createCollection();
  storyRelayDrafts.write(fixture.key(0), '未送达故事');
  fixture.dispatch.mockImplementationOnce(async () => {
    const task = fixture.tasks[0]!;
    const current = fixture.session.getSnapshot();
    if (current.phase !== 'ready') throw new Error('Not ready');
    fixture.acknowledge(
      {
        type: 'storyrelay.task.skip',
        roundId: task.roundId,
        stepIndex: task.stepIndex,
        chainId: task.chainId,
        seat: task.authorSeat,
        phaseRevision: current.snapshot.state.phaseRevision,
      },
      null,
    );
    return {
      kind: 'decided',
      decision: { kind: 'rejected', commandId: 'late', reason: '已经收稿' },
    };
  });
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(storyRelayDrafts.read(fixture.key(0))).toBe('未送达故事');
  expect(fixture.dispatch).toHaveBeenCalledTimes(1);
});

it('preserves oversized text for correction instead of truncating or submitting a blank', async () => {
  const fixture = createCollection();
  storyRelayDrafts.write(fixture.key(0), '字'.repeat(513));
  const { result } = fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('failed');
  expect(fixture.dispatch).not.toHaveBeenCalled();
  expect(storyRelayDrafts.read(fixture.key(0))).toHaveLength(513);
});

it('collects other valid bot manuscripts while retaining one oversized draft for correction', async () => {
  const fixture = createCollection();
  storyRelayDrafts.write(fixture.key(0), '字'.repeat(513));
  for (let seat = 1; seat < 4; seat += 1) storyRelayDrafts.write(fixture.key(seat), `稿件${seat}`);
  const { result } = fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('failed');
  expect(fixture.dispatch).toHaveBeenCalledTimes(3);
  expect(storyRelayDrafts.read(fixture.key(0))).toHaveLength(513);
  for (let seat = 1; seat < 4; seat += 1)
    expect(storyRelayDrafts.read(fixture.key(seat))).toBeNull();
});

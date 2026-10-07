/** Public-engine collection tests cover automatic submissions from current-page inputs. */

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

import { useStoryRelayAutoSubmission } from '../useStoryRelayAutoSubmission';

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
  const inputs = new Map<number, string>();
  return {
    session,
    dispatch,
    acknowledge,
    inputs,
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
        return useStoryRelayAutoSubmission(current.snapshot.state, 'host', session, inputs);
      });
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('automatically submits all owned inputs with original whitespace', async () => {
  const fixture = createCollection();
  for (let seat = 0; seat < 4; seat += 1) fixture.inputs.set(seat, ` 原稿 ${seat}\n`);
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(4);
  expect(fixture.session.getSnapshot()).toMatchObject({
    snapshot: { state: { phase: 'transition' } },
  });
  expect(
    fixture.dispatch.mock.calls.map(([command]) => ('text' in command ? command.text : null)),
  ).toEqual([0, 1, 2, 3].map((seat) => ` 原稿 ${seat}\n`));
});

it('automatically submits blank for every owned seat without current-page input', async () => {
  const fixture = createCollection();
  fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(4);
  expect(
    fixture.dispatch.mock.calls.every(
      ([command]) => command.type === 'storyrelay.task.empty.submit',
    ),
  ).toBe(true);
});

it('waits for the shared pending command to settle without creating a second delivery', async () => {
  const fixture = createCollection();
  fixture.inputs.set(0, '待确认原文');
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
  await act(async () => {
    fixture.acknowledge(fixture.dispatch.mock.calls[0]![0], null);
    fixture.pending(0);
  });
  expect(fixture.dispatch).toHaveBeenCalledTimes(4);
});

it('does not truncate invalid input or block valid inputs from other bots', async () => {
  const fixture = createCollection();
  fixture.inputs.set(0, '字'.repeat(513));
  for (let seat = 1; seat < 4; seat += 1) fixture.inputs.set(seat, `稿件${seat}`);
  const { result } = fixture.mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.status).toBe('failed');
  expect(fixture.dispatch).toHaveBeenCalledTimes(3);
});

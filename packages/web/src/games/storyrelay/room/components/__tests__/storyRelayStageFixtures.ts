/** Real-engine Story Relay states and stage props shared by the stage component tests. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  type StoryRelayConfig,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

/** Drives room 1234 (host `host` at seat 0, others `u<seat>`) through the real engine. */
export function createStoryRelayDriver(config: Partial<StoryRelayConfig>) {
  let commandNumber = 0;
  let nowMs = 1000;
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, ...config },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const execution = () => ({ nowMs, commandId: `command:${commandNumber++}`, randomSeed: 'round' });
  const apply = (command: StoryRelayCommand, context: CommandContext) => {
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  const asSeat = (command: StoryRelayCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: seat === 0 ? 'host' : `u${seat}` },
      controlledSeat: null,
      ...execution(),
    });
  const taskOf = (seat: number) => {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error(`seat ${seat} has no task`);
    return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
  };
  return {
    read: () => state,
    asSeat,
    /** Seats four humans named 玩家0…玩家3 and begins the round. */
    beginWithHumans: () => {
      for (let seat = 0; seat < 4; seat += 1) {
        asSeat({ type: 'room.seat.take', seat, profile: { displayName: `玩家${seat}` } }, seat);
      }
      asSeat({ type: 'storyrelay.game.begin' }, 0);
    },
    /** Every seat readies and hands in `第N棒`, then the transition settles at its deadline. */
    playStep: (stepIndex: number) => {
      for (let seat = 0; seat < 4; seat += 1) {
        asSeat({ type: 'storyrelay.task.ready.set', ...taskOf(seat), isReady: true }, seat);
      }
      for (let seat = 0; seat < 4; seat += 1) {
        asSeat(
          { type: 'storyrelay.text.submit', ...taskOf(seat), text: `第${stepIndex + 1}棒` },
          seat,
        );
      }
      if (state.deadlineAt === null) throw new Error(`no deadline in ${state.phase}`);
      nowMs = state.deadlineAt;
      apply(
        { type: 'storyrelay.phase.settleExpired' },
        {
          actor: { kind: 'system', effectId: 'effect:test' },
          controlledSeat: null,
          ...execution(),
        },
      );
    },
  };
}

/** The host fills four bot seats and begins; the round is in its first answering phase. */
export function botAnsweringState(
  writingDurationSeconds: StoryRelayConfig['writingDurationSeconds'],
): StoryRelayState {
  const driver = createStoryRelayDriver({ writingDurationSeconds, transitionDurationSeconds: 0 });
  driver.asSeat({ type: 'room.seat.fillBots' }, 0);
  driver.asSeat({ type: 'storyrelay.game.begin' }, 0);
  const state = driver.read();
  if (state.phase !== 'answering') throw new Error('Expected the answering phase');
  return state;
}

/** A ready fake link on `state`, plus a submit that always commits. */
export function testStageSession(state: StoryRelayState) {
  const session = createFakeRoomLink<StoryRelayState, StoryRelayCommand>(
    readyLinkSnapshot(testIdentity('storyrelay'), createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  const submit = vi.fn<ReadyRoomSession<StoryRelayState, StoryRelayCommand>['submit']>(
    async () => true,
  );
  return { session, submit };
}

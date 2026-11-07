/** Canonical StoryRelay states for client tests (AU-46): minimal, and a round played through. */

import type {
  StoryRelayCommand,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  storyRelayEngine,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { ReviewTestRounds } from './reviewTestRounds';

const ROOM_CODE = 'ABCD';
const HOST_USER_ID = 'host-1';

/** The players of `playStoryRelayTestRound`, by seat; the host sits at seat 0. */
export const STORY_RELAY_TEST_PLAYER_NAMES = ['阿杰', '小雨', '大熊', '米粒'] as const;

/** One scripted round of `playStoryRelayTestRound`. */
export interface StoryRelayTestRound {
  /** Per relay step, the seats that hand in a blank; steps past the list blank nobody. */
  readonly blankSeats?: readonly (readonly number[])[];
  /** The host aborts as this step opens (0: before anything was handed in); omitted plays to the end. */
  readonly abortAtStep?: number;
}

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

/** The engine's initial lobby state for room ABCD, with field overrides. */
export function buildStoryRelayTestState(
  overrides: Partial<StoryRelayState> = {},
): StoryRelayState {
  return {
    ...storyRelayEngine.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
      roomCode: ROOM_CODE,
      hostUserId: HOST_USER_ID,
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}

/** The passage a seat writes at a relay step of `playStoryRelayTestRound`. */
export function storyRelayTestText(stepIndex: number, seat: number): string {
  return `第${stepIndex + 1}棒·${STORY_RELAY_TEST_PLAYER_NAMES[seat]}写下的段落`;
}

/**
 * Plays a four-seat round through the real engine: every seat marks each
 * step ready, then hands in its passage (`storyRelayTestText`) or a blank
 * as the script says, and the transition settles at its deadline through
 * the system channel. The round ends with the host finishing the
 * playback, or aborts as `abortAtStep` opens.
 */
export function playStoryRelayTestRound(round: StoryRelayTestRound = {}): StoryRelayState {
  const numberOfPlayers = STORY_RELAY_TEST_PLAYER_NAMES.length;
  let nowMs = 0;
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers },
    { roomCode: ROOM_CODE, hostUserId: HOST_USER_ID, nowMs, commandId: 'create' },
  );
  const read = (): StoryRelayState => state;
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  const apply = (command: StoryRelayCommand, context: CommandContext) => {
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
    }
    state = storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state));
  };
  const asSeat = (command: StoryRelayCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: seat === 0 ? HOST_USER_ID : `u${seat}` },
      controlledSeat: null,
      ...execution(),
    });
  const taskOf = (seat: number) => {
    const task = getStoryRelayTaskForSeat(read(), seat);
    if (task === null) throw new Error(`[FAIL-FAST] Story Relay seat ${seat} has no task`);
    return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
  };
  const settle = () => {
    const { deadlineAt, phase } = read();
    if (deadlineAt === null) throw new Error(`[FAIL-FAST] Story Relay ${phase} has no deadline`);
    nowMs = deadlineAt;
    apply(
      { type: 'storyrelay.phase.settleExpired' },
      { actor: { kind: 'system', effectId: 'effect:test' }, controlledSeat: null, ...execution() },
    );
  };

  STORY_RELAY_TEST_PLAYER_NAMES.forEach((displayName, seat) =>
    asSeat({ type: 'room.seat.take', seat, profile: { displayName } }, seat),
  );
  asSeat({ type: 'storyrelay.game.begin' }, 0);
  for (let stepIndex = 0; stepIndex < numberOfPlayers; stepIndex += 1) {
    if (round.abortAtStep === stepIndex) {
      asSeat({ type: 'storyrelay.game.abort', phaseRevision: read().phaseRevision }, 0);
      return read();
    }
    for (let seat = 0; seat < numberOfPlayers; seat += 1) {
      asSeat({ type: 'storyrelay.task.ready.set', ...taskOf(seat), isReady: true }, seat);
    }
    for (let seat = 0; seat < numberOfPlayers; seat += 1) {
      asSeat(
        round.blankSeats?.[stepIndex]?.includes(seat) === true
          ? { type: 'storyrelay.task.empty.submit', ...taskOf(seat) }
          : {
              type: 'storyrelay.text.submit',
              ...taskOf(seat),
              text: storyRelayTestText(stepIndex, seat),
            },
        seat,
      );
    }
    settle();
  }
  asSeat({ type: 'storyrelay.gallery.finish', phaseRevision: read().phaseRevision }, 0);
  const ended = read();
  if (ended.phase !== 'ended') {
    throw new Error(`[FAIL-FAST] Story Relay test round stopped in ${ended.phase}`);
  }
  return ended;
}

export const STORYRELAY_REVIEW_ROUNDS: ReviewTestRounds<StoryRelayState> = {
  lobby: () => buildStoryRelayTestState(),
  ended: () => playStoryRelayTestRound(),
  nextRound: (ended) => ({ ...ended, roundNumber: ended.roundNumber + 1 }),
};

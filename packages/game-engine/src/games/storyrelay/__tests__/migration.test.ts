/** v1 -> v2 roster migration: legacy states must come back seat-by-seat identical. */

import type { CommandContext } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { StoryRelayCommand } from '../commands/types';
import { storyRelayEngine } from '../engine';
import { migratePersistedStoryRelayState, parseStoryRelayState } from '../state/codec';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayBotSeats,
  getStoryRelayOccupiedSeatCount,
  type StoryRelayState,
} from '../state/types';

function context(commandId: string): CommandContext {
  return {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    nowMs: 1000,
    commandId,
    randomSeed: 'round',
  };
}

function dispatch(state: StoryRelayState, command: StoryRelayCommand, id: string): StoryRelayState {
  const decision = storyRelayEngine.decide(state, command, context(id));
  if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
  return storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state));
}

function filledLobby(): StoryRelayState {
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
  );
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
    'take',
  );
  state = dispatch(state, { type: 'room.seat.fillBots' }, 'fill');
  return state;
}

/** Rebuilds the exact document a v1 client/server would have persisted. */
function downgradeToV1(state: StoryRelayState): Record<string, unknown> {
  const { roster: _roster, ...rest } = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  return {
    ...rest,
    stateVersion: 1,
    realSeats: getHumanSeatMap(state.roster, state.config.numberOfPlayers),
    botSeats: getStoryRelayBotSeats(state),
  };
}

describe('Story Relay v1 -> v2 roster migration', () => {
  it('migrates a filled lobby seat-by-seat', () => {
    const state = filledLobby();
    expect(getStoryRelayBotSeats(state)).toEqual([1, 2, 3]);
    const legacy = downgradeToV1(state);
    expect(() => parseStoryRelayState(legacy)).toThrow();
    expect(migratePersistedStoryRelayState(legacy)).toEqual(state);
    expect(migratePersistedStoryRelayState(state)).toEqual(state);
  });

  it('migrates a lobby where a bot was kicked (seat left empty)', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'room.seat.kick', seat: 2 }, 'kick');
    expect(getStoryRelayOccupiedSeatCount(state)).toBe(3);
    expect(migratePersistedStoryRelayState(downgradeToV1(state))).toEqual(state);
  });

  it('migrates an in-progress round without touching participants or chains', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'storyrelay.round.start' }, 'start');
    expect(state.phase).toBe('answering');
    expect(state.participants).toHaveLength(4);
    expect(migratePersistedStoryRelayState(downgradeToV1(state))).toEqual(state);
  });

  it('rejects a v1 document whose bot seats overlap human seats', () => {
    const legacy = downgradeToV1(filledLobby());
    (legacy as { botSeats: number[] }).botSeats = [0, 1, 2, 3];
    expect(() => migratePersistedStoryRelayState(legacy)).toThrow();
  });
});

/**
 * Room Commands — werewolf scenario (E-1 closer).
 *
 * Runs the shared room-command propositions against the real
 * werewolf engine through its public decide. The driver's config
 * variants grow the template to seven players (valid), duplicate
 * the seer (invalid — the validation message is the suite's config
 * reason), or shrink it to five (werewolf's registered divergence:
 * no occupied gate, the template reducer kicks the stranded seat).
 *
 * Werewolf-specific propositions below pin the registered
 * divergences and the event form: fill-bots keeps its Unseated-only
 * gate, and seat changes commit as a single SEATS_CHANGED batch
 * whose fold moves the players axis with the roster.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext, Decision } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS, REASON_NOT_HOST } from '../../../platform/protocol/reasons';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { WerewolfCommand } from '../commands/types';
import { GameStatus, getPlayerCount, type RoleId } from '../domain/models';
import type { GameState } from '../domain/protocol/types';
import type { StateAction } from '../domain/reducer/types';
import { REASON_INVALID_DISPLAY_NAME } from '../domain/seating';
import type { WerewolfEffect } from '../effects/types';
import { werewolfEngine } from '../engine';

type WerewolfDecision = Decision<StateAction, WerewolfEffect>;

const SIX_PLAYERS: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
const SEVEN_PLAYERS: readonly RoleId[] = [...SIX_PLAYERS, 'villager'];
const FIVE_PLAYERS: readonly RoleId[] = ['wolf', 'seer', 'witch', 'villager', 'villager'];
const DUPLICATE_SEER: readonly RoleId[] = ['wolf', 'seer', 'seer', 'witch', 'villager', 'villager'];
const INVALID_TEMPLATE_REASON = '预言家不能重复选择';

function context(actor: RoomScenarioActor): CommandContext {
  return {
    actor: { kind: 'user', userId: actor.userId },
    controlledSeat: actor.controlledSeat,
    nowMs: 1000,
    commandId: 'room-commands-scenario',
    randomSeed: 'room-commands',
  };
}

function userContext(userId: string): CommandContext {
  return context({ userId, controlledSeat: null });
}

function buildCommand(intent: RoomScenarioIntent): WerewolfCommand {
  switch (intent.kind) {
    case 'take':
      return {
        type: 'room.seat.take',
        seat: intent.seat,
        profile: { displayName: intent.displayName },
      };
    case 'leave':
      return { type: 'room.seat.leave' };
    case 'updateProfile':
      return { type: 'room.profile.update', profile: { displayName: intent.displayName } };
    case 'fillBots':
      return { type: 'room.seat.fillBots' };
    case 'kick':
      return { type: 'room.seat.kick', seat: intent.seat };
    case 'clear':
      return { type: 'room.seat.clear' };
    case 'config': {
      const templateRoles =
        intent.variant === 'valid'
          ? SEVEN_PLAYERS
          : intent.variant === 'shrinking'
            ? FIVE_PLAYERS
            : DUPLICATE_SEER;
      return { type: 'werewolf.config.update', templateRoles };
    }
  }
}

function freshState(): GameState {
  return werewolfEngine.createInitialState(
    { templateRoles: [...SIX_PLAYERS] },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
}

function evolveDecision(state: GameState, decision: WerewolfDecision): GameState {
  if (decision.kind === 'reject') throw new Error(`unexpected rejection: ${decision.reason}`);
  let next = state;
  for (const event of decision.events) next = werewolfEngine.evolve(next, event);
  return werewolfEngine.normalize(next);
}

function applyCommand(state: GameState, command: WerewolfCommand, userId: string): GameState {
  return evolveDecision(state, werewolfEngine.decide(state, command, userContext(userId)));
}

function assignedState(): GameState {
  let state = freshState();
  for (let seat = 0; seat < SIX_PLAYERS.length; seat += 1) {
    const userId = seat === 0 ? 'host' : `u${seat}`;
    state = applyCommand(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      userId,
    );
  }
  state = applyCommand(state, { type: 'werewolf.roles.assign' }, 'host');
  if (state.status !== GameStatus.Assigned) throw new Error('leaveLobby stayed in the lobby');
  return state;
}

function makeSession(): RoomCommandsSession {
  let state = freshState();
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = werewolfEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    state = evolveDecision(state, decision);
    return null;
  };
  return {
    dispatch,
    occupantKind: (seat) => {
      const occupant = state.roster[seat];
      if (occupant == null) return 'empty';
      return isBotOccupant(occupant) ? 'bot' : 'human';
    },
    displayName: (seat) => {
      const occupant = state.roster[seat];
      return occupant == null || isBotOccupant(occupant) ? null : occupant.profile.displayName;
    },
    seatCount: () => getPlayerCount(state.templateRoles),
    leaveLobby: () => {
      state = assignedState();
    },
  };
}

describeRoomCommands({
  game: 'werewolf',
  hostUserId: 'host',
  seatCount: 6,
  validSeatCount: 7,
  phaseReason: REASON_GAME_IN_PROGRESS,
  configReason: INVALID_TEMPLATE_REASON,
  blankNameReason: REASON_INVALID_DISPLAY_NAME,
  occupiedReason: null,
  refillRejection: 'invalid_status',
  fillBotsPhaseReason: 'invalid_status',
  makeSession,
});

describe('Room Commands - werewolf divergences', () => {
  it('emits one SEATS_CHANGED batch for a seat move, folding leave and join', () => {
    let state = freshState();
    state = applyCommand(
      state,
      { type: 'room.seat.take', seat: 1, profile: { displayName: 'Guest' } },
      'guest',
    );

    const decision = werewolfEngine.decide(
      state,
      { type: 'room.seat.take', seat: 2, profile: { displayName: 'Guest' } },
      userContext('guest'),
    );
    if (decision.kind !== 'commit') throw new Error('expected a commit');
    expect(decision.events).toHaveLength(1);
    const event = decision.events[0]!;
    if (event.type !== 'SEATS_CHANGED') throw new Error('expected a SEATS_CHANGED event');
    expect(event.changes.map((change) => change.seat)).toEqual([1, 2]);

    const next = evolveDecision(state, decision);
    expect(next.roster[1]).toBeUndefined();
    expect(next.players[1]).toBeNull();
    expect(next.roster[2]).toMatchObject({ userId: 'guest' });
    expect(next.players[2]).toEqual({ seat: 2, role: null });
  });

  it('commits empty when clearing an empty room', () => {
    const decision = werewolfEngine.decide(
      freshState(),
      { type: 'room.seat.clear' },
      userContext('host'),
    );
    expect(decision).toMatchObject({ kind: 'commit', events: [] });
  });

  it('kicks the stranded occupant when a template shrinks (no occupied gate)', () => {
    let state = freshState();
    state = applyCommand(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      'host',
    );
    state = applyCommand(
      state,
      { type: 'room.seat.take', seat: 5, profile: { displayName: 'Last' } },
      'last',
    );

    const next = applyCommand(
      state,
      { type: 'werewolf.config.update', templateRoles: [...FIVE_PLAYERS] },
      'host',
    );
    expect(getPlayerCount(next.templateRoles)).toBe(5);
    expect(Object.keys(next.players)).toHaveLength(5);
    expect(next.roster[5]).toBeUndefined();
    expect(next.roster[0]).toMatchObject({ userId: 'host' });
  });

  it('rejects a config update outside the lobby statuses with invalid_status', () => {
    const state = assignedState();
    const decision = werewolfEngine.decide(
      state,
      { type: 'werewolf.config.update', templateRoles: [...SEVEN_PLAYERS] },
      userContext('host'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'invalid_status' });
  });

  it.each([GameStatus.Ready, GameStatus.Ongoing, GameStatus.Ended])(
    'rejects a config update in status %s with invalid_status',
    (status) => {
      const decision = werewolfEngine.decide(
        { ...assignedState(), status },
        { type: 'werewolf.config.update', templateRoles: [...SEVEN_PLAYERS] },
        userContext('host'),
      );
      expect(decision).toEqual({ kind: 'reject', reason: 'invalid_status' });
    },
  );

  it('applies a config update in the Seated status', () => {
    let state = freshState();
    for (let seat = 0; seat < SIX_PLAYERS.length; seat += 1) {
      const userId = seat === 0 ? 'host' : `u${seat}`;
      state = applyCommand(
        state,
        { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
        userId,
      );
    }
    if (state.status !== GameStatus.Seated) throw new Error('expected a seated room');
    const next = applyCommand(
      state,
      { type: 'werewolf.config.update', templateRoles: [...SEVEN_PLAYERS] },
      'host',
    );
    expect(getPlayerCount(next.templateRoles)).toBe(7);
    expect(Object.keys(next.players)).toHaveLength(7);
  });

  it('rejects a non-host config update with not_host ahead of validation', () => {
    const decision = werewolfEngine.decide(
      freshState(),
      { type: 'werewolf.config.update', templateRoles: [...DUPLICATE_SEER] },
      userContext('guest'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('updates the profile through the UPDATE_PLAYER_PROFILE event, merging fields', () => {
    let state = freshState();
    state = applyCommand(
      state,
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'Host', avatarUrl: 'https://img/a.png' },
      },
      'host',
    );

    const decision = werewolfEngine.decide(
      state,
      { type: 'room.profile.update', profile: { displayName: 'Renamed' } },
      userContext('host'),
    );
    expect(decision).toMatchObject({
      kind: 'commit',
      events: [
        { type: 'UPDATE_PLAYER_PROFILE', payload: { userId: 'host', displayName: 'Renamed' } },
      ],
    });

    const next = evolveDecision(state, decision);
    const occupant = next.roster[0];
    if (occupant == null || isBotOccupant(occupant)) throw new Error('expected a human occupant');
    expect(occupant.profile.displayName).toBe('Renamed');
    expect(occupant.profile.avatarUrl).toBe('https://img/a.png');
  });

  it('hears game_in_progress for an unseated leave after the lobby (lobby gate first)', () => {
    const decision = werewolfEngine.decide(
      assignedState(),
      { type: 'room.seat.leave' },
      userContext('guest'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_GAME_IN_PROGRESS });
  });

  it('rejects fill-bots from a non-host in the lobby with not_host', () => {
    const decision = werewolfEngine.decide(
      freshState(),
      { type: 'room.seat.fillBots' },
      userContext('guest'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });
});

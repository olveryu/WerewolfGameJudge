/**
 * Room Commands — avalon scenario (E-1).
 *
 * Runs the shared room-command propositions against the real avalon
 * engine through its public decide. The room is the default
 * six-player board; the driver's config variants move the board to
 * seven players (valid), four (invalid), or five (shrinking, which
 * strands the last seat).
 */

import type { CommandContext } from '../../../platform/engine';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { AvalonCommand } from '../commands/types';
import { AVALON_REASONS } from '../domain/decision';
import { avalonEngine } from '../engine';
import { type AvalonState, DEFAULT_AVALON_CONFIG } from '../state/types';

function buildCommand(intent: RoomScenarioIntent): AvalonCommand {
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
      const count = intent.variant === 'valid' ? 7 : intent.variant === 'shrinking' ? 5 : 4;
      return {
        type: 'avalon.config.update',
        // The invalid variant deliberately leaves the AvalonPlayerCount union.
        config: {
          ...DEFAULT_AVALON_CONFIG,
          numberOfPlayers: count as typeof DEFAULT_AVALON_CONFIG.numberOfPlayers,
        },
      };
    }
  }
}

function makeSession(): RoomCommandsSession {
  let state: AvalonState = avalonEngine.createInitialState(DEFAULT_AVALON_CONFIG, {
    roomCode: '1234',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
  const context = (actor: RoomScenarioActor): CommandContext => ({
    actor: { kind: 'user', userId: actor.userId },
    controlledSeat: actor.controlledSeat,
    nowMs: 1000,
    commandId: 'room-commands-scenario',
    randomSeed: 'room-commands',
  });
  const dispatch = (intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null => {
    const decision = avalonEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = avalonEngine.evolve(state, event);
    state = avalonEngine.normalize(state);
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
    seatCount: () => state.config.numberOfPlayers,
    leaveLobby: () => {
      for (let seat = 0; seat < 6; seat += 1) {
        const userId = seat === 0 ? 'host' : `u${seat}`;
        const reason = dispatch(
          { kind: 'take', seat, displayName: `P${seat}` },
          { userId, controlledSeat: null },
        );
        if (reason !== null) throw new Error(`leaveLobby take failed: ${reason}`);
      }
      const decision = avalonEngine.decide(
        state,
        { type: 'avalon.roles.assign' },
        context({ userId: 'host', controlledSeat: null }),
      );
      if (decision.kind === 'reject')
        throw new Error(`leaveLobby assign failed: ${decision.reason}`);
      for (const event of decision.events) state = avalonEngine.evolve(state, event);
      state = avalonEngine.normalize(state);
      if (state.phase.kind === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'avalon',
  hostUserId: 'host',
  seatCount: 6,
  validSeatCount: 7,
  phaseReason: AVALON_REASONS.phase,
  configReason: AVALON_REASONS.config,
  occupiedReason: AVALON_REASONS.occupied,
  makeSession,
});

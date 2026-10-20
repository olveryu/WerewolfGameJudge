/**
 * Room Commands — demo scenario (E-1).
 *
 * Runs the shared room-command propositions against the real demo
 * engine through its public decide. The room is the default
 * six-player config; the driver's config variants move it to seven
 * players (valid), three (invalid), or five (shrinking, which
 * strands the last seat). Demo is the generator's stage-preset
 * product, so this file also stands for every generated game.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  describeRoomCommands,
  type RoomCommandsSession,
  type RoomScenarioActor,
  type RoomScenarioIntent,
} from '../../../platform/room/__tests__/roomCommandsScenarios';
import { isBotOccupant } from '../../../platform/room/seating';
import type { DemoCommand } from '../commands/types';
import { DEMO_REASONS } from '../domain/decision';
import { demoEngine } from '../engine';
import { DEFAULT_DEMO_CONFIG, type DemoState } from '../state/types';

function buildCommand(intent: RoomScenarioIntent): DemoCommand {
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
      const numberOfPlayers =
        intent.variant === 'valid' ? 7 : intent.variant === 'shrinking' ? 5 : 3;
      return { type: 'demo.config.update', config: { numberOfPlayers } };
    }
  }
}

function makeSession(): RoomCommandsSession {
  let state: DemoState = demoEngine.createInitialState(DEFAULT_DEMO_CONFIG, {
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
    const decision = demoEngine.decide(state, buildCommand(intent), context(actor));
    if (decision.kind === 'reject') return decision.reason;
    for (const event of decision.events) state = demoEngine.evolve(state, event);
    state = demoEngine.normalize(state);
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
      const decision = demoEngine.decide(
        state,
        { type: 'demo.roles.assign' },
        context({ userId: 'host', controlledSeat: null }),
      );
      if (decision.kind === 'reject')
        throw new Error(`leaveLobby assign failed: ${decision.reason}`);
      for (const event of decision.events) state = demoEngine.evolve(state, event);
      state = demoEngine.normalize(state);
      if (state.phase.kind === 'lobby') throw new Error('leaveLobby stayed in the lobby');
    },
  };
}

describeRoomCommands({
  game: 'demo',
  hostUserId: 'host',
  seatCount: 6,
  validSeatCount: 7,
  phaseReason: DEMO_REASONS.phase,
  configReason: DEMO_REASONS.config,
  occupiedReason: DEMO_REASONS.occupied,
  makeSession,
});

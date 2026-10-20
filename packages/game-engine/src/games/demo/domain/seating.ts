/** Lobby-only Demo seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { DemoCommand } from '../commands/types';
import { type DemoState, isValidDemoConfig } from '../state/types';
import { commitDemo, DEMO_REASONS, type DemoDecision } from './decision';

type RoomCommand = Extract<DemoCommand, { readonly type: `room.${string}` | 'demo.config.update' }>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideDemoRoom(
  state: DemoState,
  command: RoomCommand,
  context: CommandContext,
): DemoDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(DEMO_REASONS.phase) : null,
      phaseReason: DEMO_REASONS.phase,
      configReason: DEMO_REASONS.config,
      occupiedReason: DEMO_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'demo.config.update'
          ? {
              invalidReason: isValidDemoConfig(resolved.config) ? null : DEMO_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({ type: 'demo.config.updated', config: { ...resolved.config } }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'demo.seats.changed', changes }),
      commit: commitDemo,
    },
  });
}

/** Lobby-only Decrypto seating over the shared room-command skeleton. */

import { type CommandContext, reject } from '../../../platform/engine';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import type { DecryptoCommand } from '../commands/types';
import { type DecryptoState, isValidDecryptoConfig } from '../state/types';
import { commitDecrypto, DECRYPTO_REASONS, type DecryptoDecision } from './decision';

type RoomCommand = Extract<
  DecryptoCommand,
  { readonly type: `room.${string}` | 'decrypto.config.update' }
>;

/** Decides lobby and profile changes with authenticated ownership. */
export function decideDecryptoRoom(
  state: DecryptoState,
  command: RoomCommand,
  context: CommandContext,
): DecryptoDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: state.config.numberOfPlayers,
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: state.phase.kind !== 'lobby' ? reject(DECRYPTO_REASONS.phase) : null,
      phaseReason: DECRYPTO_REASONS.phase,
      configReason: DECRYPTO_REASONS.config,
      occupiedReason: DECRYPTO_REASONS.occupied,
      profileLanding: { kind: 'rosterChange' },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'decrypto.config.update'
          ? {
              invalidReason: isValidDecryptoConfig(resolved.config)
                ? null
                : DECRYPTO_REASONS.config,
              newSeatCount: resolved.config.numberOfPlayers,
              buildEvent: () => ({
                type: 'decrypto.config.updated',
                config: { ...resolved.config },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes) => ({ type: 'decrypto.seats.changed', changes }),
      commit: commitDecrypto,
    },
  });
}

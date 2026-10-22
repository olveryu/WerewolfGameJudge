/**
 * Werewolf room commands over the shared room-command skeleton (E-1).
 *
 * The skeleton owns the gate order; werewolf injects what is its own:
 *
 * - Phase vocabulary, computed per command from its status machine.
 *   Seat commands (take / leave / kick / clear) hear the platform
 *   game-in-progress code outside the lobby statuses (Unseated /
 *   Seated); the config update hears werewolf's game-control code
 *   (invalid_status); fill-bots keeps its handler-era gate — it
 *   admits only the Unseated status and hears invalid_status
 *   everywhere else.
 * - The seats-changed event form: a SEATS_CHANGED batch action
 *   carrying the roster changes. The reducer folds each change
 *   through the per-seat transitions, so the players axis is born
 *   and dies in the reducer, never in the skeleton.
 * - The profile landing: werewolf's own UPDATE_PLAYER_PROFILE
 *   action (the reducer merges the update into the occupant's
 *   profile; no player record is rebuilt).
 * - The config facts: template validation only. Werewolf's config
 *   has no occupancy dimension — a shrinking template strands and
 *   kicks the seats beyond the new count in the template reducer —
 *   so no new seat count is injected and the occupied gate is
 *   skipped.
 */

import { type CommandContext, type Decision, reject } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS } from '../../../platform/protocol/reasons';
import { decideRoomCommands } from '../../../platform/room/roomCommands';
import { isBotOccupant } from '../../../platform/room/seating';
import type { WerewolfCommand } from '../commands/types';
import type { WerewolfEffect } from '../effects/types';
import { commitActions } from './decision';
import { GameStatus, getPlayerCount, validateTemplateRoles } from './models';
import type { GameState } from './protocol/types';
import type {
  SeatsChangedAction,
  StateAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
} from './reducer/types';

/** The rejection code for a blank display name (take / profile update). */
export const REASON_INVALID_DISPLAY_NAME = 'invalid_display_name' as const;

/** The room commands this adapter decides: the shared seat/profile commands plus the config update. */
export type RoomCommand = Extract<
  WerewolfCommand,
  { readonly type: `room.${string}` | 'werewolf.config.update' }
>;

type WerewolfDecision = Decision<StateAction, WerewolfEffect>;

export function isWerewolfRoomCommand(command: WerewolfCommand): command is RoomCommand {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'werewolf.config.update':
      return true;
    default:
      return false;
  }
}

function isInLobby(state: GameState): boolean {
  return state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
}

/**
 * Werewolf's lobby rejection for one command, ready-made for the
 * skeleton. Fill-bots keeps its single-status gate: only the
 * Unseated status admits it (a filled room is past filling, and the
 * game-control vocabulary answers invalid_status). The config
 * update shares that vocabulary outside the lobby statuses; the
 * seat commands hear the platform game-in-progress code.
 */
function lobbyRejection(state: GameState, command: RoomCommand): WerewolfDecision | null {
  switch (command.type) {
    case 'room.profile.update':
      // The skeleton decides profile updates ahead of the lobby gate.
      return null;
    case 'room.seat.fillBots':
      return state.status === GameStatus.Unseated ? null : reject('invalid_status');
    case 'werewolf.config.update':
      return isInLobby(state) ? null : reject('invalid_status');
    default:
      return isInLobby(state) ? null : reject(REASON_GAME_IN_PROGRESS);
  }
}

/** Decides seat, profile, fill, and config commands with the shared skeleton. */
export function decideWerewolfRoom(
  state: GameState,
  command: RoomCommand,
  context: CommandContext,
): WerewolfDecision {
  return decideRoomCommands({
    facts: {
      roster: state.roster,
      seatCount: getPlayerCount(state.templateRoles),
      hostUserId: state.hostUserId,
    },
    command,
    context,
    options: {
      lobbyRejection: lobbyRejection(state, command),
      // Every routed command is decided by an earlier skeleton branch
      // or by the config facts below; the phase reason is the fallback
      // for a command this adapter is ever handed without either.
      phaseReason: REASON_GAME_IN_PROGRESS,
      configReason: REASON_INVALID_DISPLAY_NAME,
      // The occupied gate is skipped (no new seat count below), so
      // this code is never emitted; it carries the config family's
      // code for orientation only.
      occupiedReason: REASON_INVALID_DISPLAY_NAME,
      profileLanding: {
        kind: 'event',
        buildEvent: (seat, profile): UpdatePlayerProfileAction => {
          const occupant = state.roster[seat];
          // The skeleton resolved this seat from the actor's user id
          // through the human seat map, so the occupant is the actor's
          // own human seat by construction.
          if (occupant == null || isBotOccupant(occupant)) {
            throw new Error(`Profile landing resolved non-human seat ${seat}`);
          }
          return {
            type: 'UPDATE_PLAYER_PROFILE',
            payload: { userId: occupant.userId, ...profile },
          };
        },
      },
      resolveConfigFacts: (resolved) =>
        resolved.type === 'werewolf.config.update'
          ? {
              invalidReason: validateTemplateRoles([...resolved.templateRoles]),
              buildEvent: (): UpdateTemplateAction => ({
                type: 'UPDATE_TEMPLATE',
                payload: {
                  templateRoles: [...resolved.templateRoles],
                  rules: resolved.rules === undefined ? undefined : { ...resolved.rules },
                },
              }),
            }
          : null,
      buildSeatsChangedEvent: (changes): SeatsChangedAction => ({
        type: 'SEATS_CHANGED',
        changes,
      }),
      commit: commitActions,
    },
  });
}

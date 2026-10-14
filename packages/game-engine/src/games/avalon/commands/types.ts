/** Avalon commands; actors come from platform authentication. Command names match §6.1 verbatim. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { AvalonBallot, AvalonConfig, AvalonPlay } from '../state/types';

export type AvalonPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'avalon.config.update'; readonly config: AvalonConfig }
  | { readonly type: 'avalon.game.start' }
  | { readonly type: 'avalon.game.begin' }
  | { readonly type: 'avalon.game.returnToLobby' }
  | { readonly type: 'avalon.role.viewed' }
  | { readonly type: 'avalon.bots.markAllBotsViewed' }
  | { readonly type: 'avalon.night.confirm' }
  | { readonly type: 'avalon.audio.ack' }
  | { readonly type: 'avalon.team.propose'; readonly seats: readonly number[] }
  | { readonly type: 'avalon.team.vote'; readonly vote: AvalonBallot }
  | { readonly type: 'avalon.vote.finish' }
  | { readonly type: 'avalon.vote.timeout' }
  | { readonly type: 'avalon.quest.play'; readonly play: AvalonPlay }
  | { readonly type: 'avalon.quest.finish' }
  | { readonly type: 'avalon.quest.timeout' }
  | { readonly type: 'avalon.lady.check'; readonly seat: number }
  | { readonly type: 'avalon.lady.acknowledge' }
  | { readonly type: 'avalon.assassin.accuse'; readonly seat: number }
  | { readonly type: 'avalon.assassin.earlyStrike'; readonly seat: number };

/**
 * Worker-originated settle commands: the room runtime fires the armed
 * reveal countdown through a scheduled `avalon.settle.due` effect, and
 * the effect handler dispatches these as the system actor. They run the
 * same settlement decide as the public timeout commands; the public
 * timeouts stay as a client acceleration path only.
 */
export type AvalonInternalCommand =
  | { readonly type: 'avalon.vote.settleExpired' }
  | { readonly type: 'avalon.quest.settleExpired' };

export type AvalonCommand = AvalonPublicCommand | AvalonInternalCommand;

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
  | { readonly type: 'avalon.game.returnToLobby' }
  | { readonly type: 'avalon.night.confirm' }
  | { readonly type: 'avalon.team.propose'; readonly seats: readonly number[] }
  | { readonly type: 'avalon.team.vote'; readonly vote: AvalonBallot }
  | { readonly type: 'avalon.vote.finish' }
  | { readonly type: 'avalon.quest.play'; readonly play: AvalonPlay }
  | { readonly type: 'avalon.quest.finish' }
  | { readonly type: 'avalon.lady.check'; readonly seat: number }
  | { readonly type: 'avalon.lady.acknowledge' }
  | { readonly type: 'avalon.assassin.accuse'; readonly seat: number }
  | { readonly type: 'avalon.assassin.earlyStrike'; readonly seat: number };

/** Avalon has no worker-originated internal commands (no timers, no external content). */
export type AvalonCommand = AvalonPublicCommand;

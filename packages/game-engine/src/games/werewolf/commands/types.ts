/** Typed Werewolf commands. Actor identity is supplied only by CommandContext. */

import type { GameRuleOverrides, RoleId } from '../../../models';
import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';

export type WerewolfSeatProfile = RoomSeatProfile;

export type WerewolfProfileUpdate = RoomProfileUpdate;

export type WerewolfActionInput =
  | { readonly kind: 'target'; readonly target: number | null }
  | { readonly kind: 'multiTarget'; readonly targets: readonly number[] }
  | { readonly kind: 'confirm' }
  | {
      readonly kind: 'witch';
      readonly saveTarget: number | null;
      readonly poisonTarget: number | null;
    }
  | { readonly kind: 'card'; readonly cardIndex: number }
  | { readonly kind: 'skip' };

type WerewolfRoomCommand =
  | RoomSeatCommand<WerewolfSeatProfile>
  | RoomProfileUpdateCommand<WerewolfProfileUpdate>;

type WerewolfGameCommand =
  | { readonly type: 'werewolf.roles.assign' }
  | { readonly type: 'werewolf.game.restart' }
  | { readonly type: 'werewolf.bots.markRolesViewed' }
  | { readonly type: 'werewolf.action.submit'; readonly input: WerewolfActionInput }
  | { readonly type: 'werewolf.role.view' }
  | {
      readonly type: 'werewolf.config.update';
      readonly templateRoles: readonly RoleId[];
      readonly rules?: Readonly<GameRuleOverrides>;
    }
  | { readonly type: 'werewolf.review.share'; readonly allowedSeats: readonly number[] }
  | {
      readonly type: 'werewolf.board.nominate';
      readonly displayName: string;
      readonly roles: readonly RoleId[];
    }
  | { readonly type: 'werewolf.board.upvote'; readonly targetUserId: string }
  | { readonly type: 'werewolf.board.withdraw' }
  | { readonly type: 'werewolf.night.start' }
  | { readonly type: 'werewolf.audio.ack' }
  | { readonly type: 'werewolf.audio.gate'; readonly isPlaying: boolean }
  | { readonly type: 'werewolf.progress.request' }
  | { readonly type: 'werewolf.reveal.ack' }
  | { readonly type: 'werewolf.wolfRobot.ackHunterStatus' }
  | { readonly type: 'werewolf.groupConfirm.ack' }
  | { readonly type: 'werewolf.groupConfirm.ackBots' };

export type WerewolfPublicCommand = WerewolfRoomCommand | WerewolfGameCommand;

export interface WerewolfApplyRosterLevelsCommand {
  readonly type: 'werewolf.growth.applyRosterLevels';
  readonly levels: Readonly<Record<string, number>>;
}

export type WerewolfInternalCommand = WerewolfApplyRosterLevelsCommand;

export type WerewolfCommand = WerewolfPublicCommand | WerewolfInternalCommand;

/** Typed Werewolf commands. Actor identity is supplied only by CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { StepSubmission } from '../../../platform/steps';
import type { GameRuleOverrides, RoleId } from '../domain/models';

export type WerewolfSeatProfile = RoomSeatProfile;

export type WerewolfProfileUpdate = RoomProfileUpdate;

type WerewolfRoomCommand =
  RoomSeatCommand<WerewolfSeatProfile> | RoomProfileUpdateCommand<WerewolfProfileUpdate>;

export interface WerewolfMvpSelection {
  readonly roleRevealRandomNonce: string | null;
  readonly mvpUserId: string;
}

type WerewolfGameCommand =
  | { readonly type: 'werewolf.roles.assign' }
  | {
      readonly type: 'werewolf.game.restart';
      readonly gameSequence: number;
      readonly wasEnded: boolean;
    }
  | { readonly type: 'werewolf.mvp.select'; readonly selection: WerewolfMvpSelection }
  | { readonly type: 'werewolf.bots.markAllBotsViewed' }
  | {
      readonly type: 'werewolf.step.submit';
      readonly gameSequence: number;
      readonly submission: StepSubmission;
    }
  | {
      readonly type: 'werewolf.step.ackBots';
      readonly gameSequence: number;
      readonly stepId: string;
      readonly serial: number;
    }
  | { readonly type: 'werewolf.role.viewed' }
  | {
      readonly type: 'werewolf.config.update';
      readonly templateRoles: readonly RoleId[];
      readonly rules?: Readonly<GameRuleOverrides>;
    }
  | { readonly type: 'werewolf.review.share'; readonly allowedSeats: readonly number[] }
  | { readonly type: 'werewolf.lastNightInfo.confirm'; readonly gameSequence: number }
  | { readonly type: 'werewolf.review.complete'; readonly gameSequence: number }
  | {
      readonly type: 'werewolf.board.nominate';
      readonly displayName: string;
      readonly roles: readonly RoleId[];
    }
  | { readonly type: 'werewolf.board.upvote'; readonly targetUserId: string }
  | { readonly type: 'werewolf.board.withdraw' }
  | { readonly type: 'werewolf.game.begin' }
  | { readonly type: 'werewolf.sheriff.register' }
  | { readonly type: 'werewolf.sheriff.cancelRegistration' }
  | { readonly type: 'werewolf.sheriff.withdraw' }
  | { readonly type: 'werewolf.sheriff.vote'; readonly targetSeat: number | null }
  | { readonly type: 'werewolf.sheriff.advance' }
  | { readonly type: 'werewolf.sheriff.endBySelfDestruct' }
  | { readonly type: 'werewolf.audio.ack'; readonly audioBatchId: number }
  | { readonly type: 'werewolf.phase.retrySettle' };

export type WerewolfPublicCommand = WerewolfRoomCommand | WerewolfGameCommand;

export interface WerewolfApplyRosterLevelsCommand {
  readonly type: 'werewolf.growth.applyRosterLevels';
  readonly levels: Readonly<Record<string, number>>;
}

/**
 * Worker-originated settle command: the room runtime delivers the armed
 * `werewolf.settle.due` effect at its deadline and dispatches this on
 * the system channel; it is the only expiry channel (D3, 2026-11-05
 * — the public expire command was deleted). It runs the expiry guard
 * and inline progression on the system channel.
 */
export interface WerewolfSettleExpiredCommand {
  readonly type: 'werewolf.phase.settleExpired';
}

export type WerewolfInternalCommand =
  WerewolfApplyRosterLevelsCommand | WerewolfSettleExpiredCommand;

export type WerewolfCommand = WerewolfPublicCommand | WerewolfInternalCommand;

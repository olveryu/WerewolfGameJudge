/** Typed Werewolf commands. Actor identity is supplied only by CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { GameRuleOverrides, RoleId, SchemaId } from '../domain/models';

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

/** Authoritative step identity captured when a player confirms one action. */
export interface WerewolfExpectedStep {
  readonly currentStepId: SchemaId;
  /** Null identifies the room's first game before any restart nonce exists. */
  readonly roleRevealRandomNonce: string | null;
}

type WerewolfRoomCommand =
  | RoomSeatCommand<WerewolfSeatProfile>
  | RoomProfileUpdateCommand<WerewolfProfileUpdate>;

export interface WerewolfMvpSelection {
  readonly roleRevealRandomNonce: string | null;
  readonly mvpUserId: string;
}

type WerewolfGameCommand =
  | { readonly type: 'werewolf.roles.assign' }
  | { readonly type: 'werewolf.game.abort' }
  | { readonly type: 'werewolf.game.returnToLobby' }
  | { readonly type: 'werewolf.game.redeal' }
  | { readonly type: 'werewolf.mvp.select'; readonly selection: WerewolfMvpSelection }
  | { readonly type: 'werewolf.bots.markAllBotsViewed' }
  | {
      readonly type: 'werewolf.action.submit';
      readonly input: WerewolfActionInput;
      /** Optional only for rolling compatibility with clients predating recoverable actions. */
      readonly expectedStep?: WerewolfExpectedStep;
    }
  | { readonly type: 'werewolf.role.viewed' }
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
  | { readonly type: 'werewolf.game.begin' }
  | { readonly type: 'werewolf.sheriff.register' }
  | { readonly type: 'werewolf.sheriff.cancelRegistration' }
  | { readonly type: 'werewolf.sheriff.withdraw' }
  | { readonly type: 'werewolf.sheriff.vote'; readonly targetSeat: number | null }
  | { readonly type: 'werewolf.sheriff.advance' }
  | { readonly type: 'werewolf.sheriff.endBySelfDestruct' }
  | { readonly type: 'werewolf.audio.ack'; readonly audioBatchId: number }
  /**
   * Client acceleration of an armed deadline that has been reached
   * (any foreground client); the scheduled `werewolf.settle.due` is
   * the correctness path.
   */
  | { readonly type: 'werewolf.phase.expire' }
  | { readonly type: 'werewolf.reveal.ack' }
  | { readonly type: 'werewolf.wolfRobot.ackHunterStatus' }
  | { readonly type: 'werewolf.groupConfirm.ack' }
  | { readonly type: 'werewolf.groupConfirm.ackBots' };

export type WerewolfPublicCommand = WerewolfRoomCommand | WerewolfGameCommand;

export interface WerewolfApplyRosterLevelsCommand {
  readonly type: 'werewolf.growth.applyRosterLevels';
  readonly levels: Readonly<Record<string, number>>;
}

/**
 * Worker-originated settle command: the room runtime delivers the armed
 * `werewolf.settle.due` effect at its deadline and dispatches this on
 * the system channel; it runs the same expiry guard and inline
 * progression as the public expire command.
 */
export interface WerewolfSettleExpiredCommand {
  readonly type: 'werewolf.phase.settleExpired';
}

export type WerewolfInternalCommand =
  | WerewolfApplyRosterLevelsCommand
  | WerewolfSettleExpiredCommand;

export type WerewolfCommand = WerewolfPublicCommand | WerewolfInternalCommand;

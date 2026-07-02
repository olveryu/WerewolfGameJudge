/**
 * Werewolf engine action contract — command names and payloads accepted by werewolfEngine.
 */

import type { GameRuleOverrides, RoleId } from './models';
import type { UpdatePlayerProfileAction } from './reducer/types';

export const WEREWOLF_ACTION = {
  ASSIGN_ROLES: 'ASSIGN_ROLES',
  FILL_WITH_BOTS: 'FILL_WITH_BOTS',
  MARK_ALL_BOTS_VIEWED: 'MARK_ALL_BOTS_VIEWED',
  CLEAR_ALL_SEATS: 'CLEAR_ALL_SEATS',
  RESTART_GAME: 'RESTART_GAME',
  SEAT: 'SEAT',
  START_NIGHT: 'START_NIGHT',
  UPDATE_TEMPLATE: 'UPDATE_TEMPLATE',
  VIEW_ROLE: 'VIEW_ROLE',
  SHARE_REVIEW: 'SHARE_REVIEW',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  BOARD_NOMINATE: 'BOARD_NOMINATE',
  BOARD_UPVOTE: 'BOARD_UPVOTE',
  BOARD_WITHDRAW: 'BOARD_WITHDRAW',
  SUBMIT_ACTION: 'SUBMIT_ACTION',
  AUDIO_ACK: 'AUDIO_ACK',
  AUDIO_GATE: 'AUDIO_GATE',
  PROGRESSION: 'PROGRESSION',
  REVEAL_ACK: 'REVEAL_ACK',
  WOLF_ROBOT_VIEWED: 'WOLF_ROBOT_VIEWED',
  GROUP_CONFIRM_ACK: 'GROUP_CONFIRM_ACK',
  MARK_BOTS_GROUP_CONFIRMED: 'MARK_BOTS_GROUP_CONFIRMED',
} as const;

export type WerewolfActionType = (typeof WEREWOLF_ACTION)[keyof typeof WEREWOLF_ACTION];

interface SeatProfileFields {
  readonly avatarUrl?: string;
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly nameStyle?: string;
  readonly roleRevealEffect?: string;
  readonly seatAnimation?: string;
  readonly level?: number;
}

export type WerewolfSeatPayload =
  | (SeatProfileFields & {
      readonly action: 'sit';
      readonly userId: string;
      readonly seat: number;
      readonly displayName: string;
    })
  | {
      readonly action: 'standup';
      readonly userId: string;
    }
  | {
      readonly action: 'kick';
      readonly userId: string;
      readonly targetSeat: number;
    };

export interface WerewolfUpdateTemplatePayload {
  readonly templateRoles: RoleId[];
  readonly rules?: GameRuleOverrides;
}

export interface WerewolfViewRolePayload {
  readonly userId: string;
  readonly seat: number;
}

export interface WerewolfShareReviewPayload {
  readonly allowedSeats: number[];
}

export type WerewolfUpdateProfilePayload = UpdatePlayerProfileAction['payload'];

export interface WerewolfBoardNominatePayload {
  readonly userId: string;
  readonly displayName: string;
  readonly roles: RoleId[];
}

export interface WerewolfBoardUpvotePayload {
  readonly voterUid: string;
  readonly targetUserId: string;
}

export interface WerewolfBoardWithdrawPayload {
  readonly userId: string;
}

export interface WerewolfSubmitActionPayload {
  readonly seat: number;
  readonly role: RoleId;
  readonly target: number | null;
  readonly extra?: unknown;
}

export interface WerewolfAudioGatePayload {
  readonly isPlaying: boolean;
}

export interface WerewolfWolfRobotViewedPayload {
  readonly seat: number;
}

export interface WerewolfGroupConfirmAckPayload {
  readonly seat: number;
  readonly userId: string;
}

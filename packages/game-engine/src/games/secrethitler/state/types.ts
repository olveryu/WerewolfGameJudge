/** Authoritative 秘密希特勒 state; secret identities with the identity-viewing checkpoint. */

import type { AudioEffect } from '../../../platform/audio';
import type { GameConfigSchema } from '../../../platform/config/configSchema';
import { isValidConfig } from '../../../platform/config/configSchema';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import {
  buildRosterViewingParticipants,
  type IdentityViewingParticipant,
} from '../../../platform/room/identityViewing';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';

export const SECRETHITLER_GAME_TYPE = 'secrethitler' as const;

export const SECRETHITLER_MIN_PLAYERS = 5;
export const SECRETHITLER_MAX_PLAYERS = 10;
export const SECRETHITLER_DEFAULT_PLAYERS = 8;
export const SECRETHITLER_VOTE_MODES = ['public', 'secret'] as const;
export type SecrethitlerVoteMode = (typeof SECRETHITLER_VOTE_MODES)[number];
export const SECRETHITLER_DEFAULT_VOTE_MODE: SecrethitlerVoteMode = 'public';

export interface SecrethitlerConfig {
  readonly numberOfPlayers: number;
  readonly voteMode: SecrethitlerVoteMode;
}

export const DEFAULT_SECRETHITLER_CONFIG: SecrethitlerConfig = {
  numberOfPlayers: SECRETHITLER_DEFAULT_PLAYERS,
  voteMode: SECRETHITLER_DEFAULT_VOTE_MODE,
};

export const SECRETHITLER_CONFIG_SCHEMA: GameConfigSchema<SecrethitlerConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      hint: '开局要求坐满全部座位（可填充机器人）。',
      min: SECRETHITLER_MIN_PLAYERS,
      max: SECRETHITLER_MAX_PLAYERS,
    },
    voteMode: {
      kind: 'choice',
      label: '投票方式',
      hint: '公投：结算后公开每人选票；暗投：只公布赞成 / 反对票数。',
      options: [
        { value: 'public', label: '公投' },
        { value: 'secret', label: '暗投' },
      ],
    },
  },
  defaults: DEFAULT_SECRETHITLER_CONFIG,
  validate: () => null,
};

/** Checks supported lobby settings without replacing invalid values. */
export function isValidSecrethitlerConfig(config: SecrethitlerConfig): boolean {
  return isValidConfig(SECRETHITLER_CONFIG_SCHEMA, config);
}

export type SecrethitlerRole = 'liberal' | 'fascist' | 'hitler';
export type SecrethitlerFaction = 'liberal' | 'fascist';
export type SecrethitlerPolicy = SecrethitlerFaction;
export type SecrethitlerVote = 'ja' | 'nein';
export type SecrethitlerPower = 'investigate' | 'specialElection' | 'execute' | 'policyPeek';
export type SecrethitlerWinner = SecrethitlerFaction;
export type SecrethitlerPublicAction = SecrethitlerPower;
export type SecrethitlerEndReason =
  'liberalPolicies' | 'hitlerExecuted' | 'fascistPolicies' | 'hitlerElected';

export type SecrethitlerPhase =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'viewing' }
  | { readonly kind: 'night'; readonly step: number; readonly confirmedSeats: readonly number[] }
  | {
      readonly kind: 'election';
      readonly presidentSeat: number;
      readonly returnToSeat: number | null;
    }
  | {
      readonly kind: 'voting';
      readonly presidentSeat: number;
      readonly chancellorSeat: number;
      readonly returnToSeat: number | null;
      readonly votes: Readonly<Record<number, SecrethitlerVote>>;
    }
  | {
      readonly kind: 'legislativePresident';
      readonly presidentSeat: number;
      readonly chancellorSeat: number;
      readonly returnToSeat: number | null;
      readonly hand: readonly SecrethitlerPolicy[];
    }
  | {
      readonly kind: 'legislativeChancellor';
      readonly vetoRejected: boolean;
      readonly presidentSeat: number;
      readonly chancellorSeat: number;
      readonly returnToSeat: number | null;
      readonly hand: readonly SecrethitlerPolicy[];
    }
  | {
      readonly kind: 'vetoResponse';
      readonly presidentSeat: number;
      readonly chancellorSeat: number;
      readonly returnToSeat: number | null;
      readonly hand: readonly SecrethitlerPolicy[];
    }
  | {
      readonly kind: 'executive';
      readonly presidentSeat: number;
      readonly returnToSeat: number | null;
      readonly power: SecrethitlerPower;
      readonly preview: readonly SecrethitlerPolicy[];
    }
  | {
      readonly kind: 'ended';
      readonly winner: SecrethitlerWinner;
      readonly reason: SecrethitlerEndReason;
    };

export interface SecrethitlerGovernmentRecord {
  readonly presidentSeat: number;
  readonly chancellorSeat: number;
  readonly outcome: 'pending' | 'passed' | 'rejected';
  readonly votes: readonly { readonly seat: number; readonly vote: SecrethitlerVote }[] | null;
}

export interface SecrethitlerPolicyRecord {
  readonly policy: SecrethitlerPolicy;
  readonly source: 'government' | 'chaos';
}

export interface SecrethitlerActionRecord {
  readonly action: SecrethitlerPublicAction;
  readonly presidentSeat: number;
  readonly targetSeat: number | null;
}

export interface SecrethitlerPublicHistory {
  readonly governments: readonly SecrethitlerGovernmentRecord[];
  readonly policies: readonly SecrethitlerPolicyRecord[];
  readonly actions: readonly SecrethitlerActionRecord[];
}

export const SECRETHITLER_PHASES = [
  'lobby',
  'viewing',
  'night',
  'election',
  'voting',
  'legislativePresident',
  'legislativeChancellor',
  'vetoResponse',
  'executive',
  'ended',
] as const;
export type SecrethitlerPhaseKind = (typeof SECRETHITLER_PHASES)[number];

export interface SecrethitlerHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface SecrethitlerState extends BaseGameState<typeof SECRETHITLER_GAME_TYPE> {
  readonly phase: SecrethitlerPhase;
  readonly phaseRevision: number;
  readonly config: SecrethitlerConfig;
  readonly roster: RosterMap<SecrethitlerHumanSeat>;
  /** seat -> 身份；发牌后写入，visibility 按查看者裁剪，终局才全公开。 */
  readonly identities: Readonly<Record<number, SecrethitlerRole>>;
  /** 已查看自己身份的座位（Identity Viewing Protocol）；全员含机器人齐全才能开始。 */
  readonly roleViewedSeats: readonly number[];
  /** 已完成的对局序号（从 0 开始）；每次开局递增，用于结算幂等。 */
  readonly gameSequence: number;
  readonly reviewCompletedUserIds: readonly string[];
  /** 终局结算 effect 恰好发出一次的标记。 */
  readonly xpSettled: boolean;
  /** 待播放的播报队列（共享 AudioEffect，音频 key 见各入队点）；房主播完提交 ack 后清空。 */
  readonly pendingAudioEffects: readonly AudioEffect[];
  /** 播报进行中标记：为真时音频门关闭（引擎 guardAudioPlayback、客户端播报锁）。 */
  readonly isAudioPlaying: boolean;
  /** 最近一次入队批次的 id（共享音频切片）；`secrethitler.audio.ack` 必须指名它播完的批次。 */
  readonly audioBatchId: number;
  readonly livingSeats: readonly number[];
  readonly nextPresidentSeat: number;
  readonly electionTracker: number;
  readonly lastPresidentSeat: number | null;
  readonly lastChancellorSeat: number | null;
  readonly liberalPolicies: number;
  readonly fascistPolicies: number;
  readonly policyDeck: readonly SecrethitlerPolicy[];
  readonly policyDiscard: readonly SecrethitlerPolicy[];
  readonly investigatedSeats: readonly number[];
  readonly lastInvestigation: {
    readonly presidentSeat: number;
    readonly targetSeat: number;
    readonly faction: SecrethitlerFaction;
  } | null;
  readonly history: SecrethitlerPublicHistory;
}

export type SecrethitlerGameplayPatch = Pick<
  SecrethitlerState,
  | 'phase'
  | 'livingSeats'
  | 'nextPresidentSeat'
  | 'electionTracker'
  | 'lastPresidentSeat'
  | 'lastChancellorSeat'
  | 'liberalPolicies'
  | 'fascistPolicies'
  | 'policyDeck'
  | 'policyDiscard'
  | 'investigatedSeats'
  | 'lastInvestigation'
  | 'history'
>;

/** Returns the seat held by a user, or null when they hold no seat. */
export function getSecrethitlerUserSeat(state: SecrethitlerState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

/** Counts occupied seats (real humans plus bots). */
export function getSecrethitlerOccupiedSeatCount(state: SecrethitlerState): number {
  return countOccupiedSeats(state.roster);
}

/** Seat is playable: occupied by a real human or a bot. */
export function isSecrethitlerOccupiedSeat(state: SecrethitlerState, seat: number): boolean {
  return state.roster[seat] != null;
}

/** Identity Viewing Protocol participants: every occupied seat with its bot flag. */
export function getSecrethitlerViewingParticipants(
  state: SecrethitlerState,
): readonly IdentityViewingParticipant[] {
  return buildRosterViewingParticipants(state.roster, state.config.numberOfPlayers);
}

/** Undercover state contracts; authoritative data only, no UI or IO. */

import type { GameConfigSchema } from '../../../platform/config/configSchema';
import { isValidConfig } from '../../../platform/config/configSchema';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { HostRevelation } from '../../../platform/room/hostReveal';
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
import {
  UNDERCOVER_BLANK_MIN_PLAYERS,
  UNDERCOVER_DEFAULT_PLAYERS,
  UNDERCOVER_MAX_PLAYERS,
  UNDERCOVER_MIN_PLAYERS,
  type UndercoverRole,
} from '../domain/rules';

export const UNDERCOVER_CATEGORIES = [
  'food',
  'dailyLife',
  'school',
  'work',
  'relationships',
  'actions',
  'entertainment',
  'sportsAndGames',
  'travel',
  'nature',
] as const;
export type UndercoverCategory = (typeof UNDERCOVER_CATEGORIES)[number];

export const UNDERCOVER_CATEGORY_NAMES: Readonly<Record<UndercoverCategory | 'all', string>> = {
  all: '全部分类',
  food: '吃喝美食',
  dailyLife: '日常生活',
  school: '校园学习',
  work: '职场工作',
  relationships: '人际关系',
  actions: '动作状态',
  entertainment: '文娱休闲',
  sportsAndGames: '运动游戏',
  travel: '出行旅行',
  nature: '自然世界',
};

export interface UndercoverConfig {
  readonly numberOfPlayers: number;
  readonly hasBlank: boolean;
  readonly category: UndercoverCategory | 'all';
}

export const DEFAULT_UNDERCOVER_CONFIG: UndercoverConfig = {
  numberOfPlayers: UNDERCOVER_DEFAULT_PLAYERS,
  hasBlank: false,
  category: 'all',
};

export const UNDERCOVER_CONFIG_SCHEMA: GameConfigSchema<UndercoverConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      hint: `启用白板至少需要 ${UNDERCOVER_BLANK_MIN_PLAYERS} 人`,
      min: UNDERCOVER_MIN_PLAYERS,
      max: UNDERCOVER_MAX_PLAYERS,
    },
    hasBlank: {
      kind: 'toggle',
      label: '白板',
      hint: '白板没有词语，替换一名平民。',
    },
    category: {
      kind: 'choice',
      label: '词语分类',
      options: (['all', ...UNDERCOVER_CATEGORIES] as const).map((category) => ({
        value: category,
        label: UNDERCOVER_CATEGORY_NAMES[category],
      })),
    },
  },
  defaults: DEFAULT_UNDERCOVER_CONFIG,
  validate: (config) =>
    config.hasBlank && config.numberOfPlayers < UNDERCOVER_BLANK_MIN_PLAYERS
      ? { field: 'hasBlank', message: `启用白板至少需要 ${UNDERCOVER_BLANK_MIN_PLAYERS} 人` }
      : null,
};

/** Validates a configuration without substituting defaults. */
export function isValidUndercoverConfig(config: UndercoverConfig): boolean {
  return isValidConfig(UNDERCOVER_CONFIG_SCHEMA, config);
}

export interface UndercoverHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface UndercoverWordPair {
  readonly id: string;
  readonly wordA: string;
  readonly wordB: string;
  readonly category: UndercoverCategory;
}

export interface UndercoverPendingRound {
  readonly roundId: string;
  readonly requestedAt: number;
  readonly shouldAllowRepeated: boolean;
}

/** A host revelation record; the platform hostReveal shape, role-typed. */
export type UndercoverRevelation = HostRevelation<UndercoverRole>;

export interface UndercoverRound {
  readonly roundId: string;
  readonly wordPair: UndercoverWordPair;
  readonly civilianWord: string;
  readonly undercoverWord: string;
  readonly roles: readonly UndercoverRole[];
  readonly speakingStartSeat: number;
  readonly confirmedSeats: readonly number[];
  readonly revelations: readonly UndercoverRevelation[];
}

export type UndercoverPreparationFailure =
  | 'selectionFailed'
  | 'inventoryEmpty'
  | 'inventoryExhausted';

interface UndercoverStateBase extends BaseGameState<'undercover'> {
  readonly config: UndercoverConfig;
  readonly roster: RosterMap<UndercoverHumanSeat>;
  readonly usedWordPairIds: readonly string[];
}

export type UndercoverState = UndercoverStateBase &
  (
    | { readonly phase: 'lobby'; readonly round: null }
    | {
        readonly phase: 'preparing';
        readonly round: null;
        readonly pendingRound: UndercoverPendingRound;
      }
    | {
        readonly phase: 'preparationFailed';
        readonly round: null;
        readonly pendingRound: UndercoverPendingRound;
        readonly failureCode: UndercoverPreparationFailure;
      }
    | { readonly phase: 'viewing' | 'ongoing'; readonly round: UndercoverRound }
    | { readonly phase: 'ended'; readonly round: UndercoverRound; readonly winner: UndercoverRole }
    | { readonly phase: 'aborted'; readonly round: UndercoverRound | null }
  );

/** Returns whether an index is a seat in this room. */
export function isUndercoverSeat(state: UndercoverState, seat: number): boolean {
  return Number.isSafeInteger(seat) && seat >= 0 && seat < state.config.numberOfPlayers;
}

/** Returns the number of occupied seats (humans and bots). */
export function getUndercoverOccupiedSeatCount(state: UndercoverState): number {
  return countOccupiedSeats(state.roster);
}

/** Identity Viewing Protocol participants: every occupied seat with its bot flag. */
export function getUndercoverViewingParticipants(
  state: UndercoverState,
): readonly IdentityViewingParticipant[] {
  return buildRosterViewingParticipants(state.roster, state.config.numberOfPlayers);
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getUndercoverUserSeat(state: UndercoverState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

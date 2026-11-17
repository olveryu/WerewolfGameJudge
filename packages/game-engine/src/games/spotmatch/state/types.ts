/** Authoritative finite-card race; no competition deadline or hidden future deck. */

import type { GameConfigSchema } from '../../../platform/config/configSchema';
import { isValidConfig } from '../../../platform/config/configSchema';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';
import type { SpotmatchCard } from '../domain/cards';

export const SPOTMATCH_GAME_TYPE = 'spotmatch' as const;

export const SPOTMATCH_MIN_PLAYERS = 2;
export const SPOTMATCH_MAX_PLAYERS = 20;
export const SPOTMATCH_DEFAULT_PLAYERS = 4;
export const SPOTMATCH_SUCCESS_PAUSE_MS = 3000;
export const SPOTMATCH_WRONG_LOCK_MS = 1000;

export interface SpotmatchConfig {
  readonly numberOfPlayers: number;
  readonly cardsPerPlayer: number;
}

export const DEFAULT_SPOTMATCH_CONFIG: SpotmatchConfig = {
  numberOfPlayers: SPOTMATCH_DEFAULT_PLAYERS,
  cardsPerPlayer: 8,
};

export const SPOTMATCH_CONFIG_SCHEMA: GameConfigSchema<SpotmatchConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      hint: '开局要求坐满全部座位（可填充机器人）。',
      min: SPOTMATCH_MIN_PLAYERS,
      max: SPOTMATCH_MAX_PLAYERS,
    },
    cardsPerPlayer: {
      kind: 'choice',
      label: '每人牌数',
      hint: '先出完者获胜；比赛不限时。',
      options: [5, 8, 10, 15].map((value) => ({ value, label: `${value} 张` })),
    },
  },
  defaults: DEFAULT_SPOTMATCH_CONFIG,
  validate: () => null,
};

/** Checks supported lobby settings without replacing invalid values. */
export function isValidSpotmatchConfig(config: SpotmatchConfig): boolean {
  return isValidConfig(SPOTMATCH_CONFIG_SCHEMA, config);
}

export type SpotmatchPhase =
  { readonly kind: 'lobby' } | { readonly kind: 'playing' } | { readonly kind: 'ended' };

export const SPOTMATCH_PHASES = ['lobby', 'playing', 'ended'] as const;
export type SpotmatchPhaseKind = (typeof SPOTMATCH_PHASES)[number];

export interface SpotmatchHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface SpotmatchPlayer {
  readonly seat: number;
  readonly userId: string | null;
  readonly isBot: boolean;
  readonly remaining: number;
  readonly correct: number;
  readonly mistakes: number;
  readonly lockedUntil: number;
  readonly lastMistake: {
    readonly centralInstanceId: string;
    readonly topInstanceId: string;
    readonly symbolId: number;
  } | null;
  /** null in other viewers' snapshots; authority always retains active tops. */
  readonly top: SpotmatchCard | null;
}

export interface SpotmatchRound {
  readonly roundId: string;
  readonly central: SpotmatchCard;
  readonly symbolMap: readonly number[];
  readonly players: readonly SpotmatchPlayer[];
  readonly serial: number;
  readonly isTest: boolean;
  readonly winnerSeat: number | null;
  readonly lastPlayedSeat: number | null;
  readonly success: {
    readonly seat: number;
    readonly symbolId: number;
    readonly previousCentral: SpotmatchCard;
    readonly until: number;
  } | null;
}

export interface SpotmatchState extends BaseGameState<typeof SPOTMATCH_GAME_TYPE> {
  readonly phase: SpotmatchPhase;
  readonly phaseRevision: number;
  readonly config: SpotmatchConfig;
  readonly roster: RosterMap<SpotmatchHumanSeat>;
  /** 已完成的对局序号（从 0 开始）；每次开局递增，用于结算幂等。 */
  readonly gameSequence: number;
  /** 终局结算 effect 恰好发出一次的标记。 */
  readonly xpSettled: boolean;
  readonly round: SpotmatchRound | null;
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getSpotmatchUserSeat(state: SpotmatchState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

/** Counts occupied seats (real humans plus bots). */
export function getSpotmatchOccupiedSeatCount(state: SpotmatchState): number {
  return countOccupiedSeats(state.roster);
}

/** Seat is playable: occupied by a real human or a bot. */
export function isSpotmatchOccupiedSeat(state: SpotmatchState, seat: number): boolean {
  return state.roster[seat] != null;
}

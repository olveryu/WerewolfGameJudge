/** Authoritative Demo state; secret identities with the identity-viewing checkpoint. */

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

export const DEMO_GAME_TYPE = 'demo' as const;

// TODO(gameplay): 人数上下限与默认值是骨架占位，按 docs/demo-game-design.md 定稿后改。
export const DEMO_MIN_PLAYERS = 4;
export const DEMO_MAX_PLAYERS = 12;
export const DEMO_DEFAULT_PLAYERS = 6;

export interface DemoConfig {
  readonly numberOfPlayers: number;
}

export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  numberOfPlayers: DEMO_DEFAULT_PLAYERS,
};

export const DEMO_CONFIG_SCHEMA: GameConfigSchema<DemoConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      hint: '开局要求坐满全部座位（可填充机器人）。',
      min: DEMO_MIN_PLAYERS,
      max: DEMO_MAX_PLAYERS,
    },
  },
  defaults: DEFAULT_DEMO_CONFIG,
  validate: () => null,
};

/** Checks supported lobby settings without replacing invalid values. */
export function isValidDemoConfig(config: DemoConfig): boolean {
  return isValidConfig(DEMO_CONFIG_SCHEMA, config);
}

export type DemoPhase =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'viewing' }
  // TODO(gameplay): playing 阶段的玩法字段（当前回合、行动座位、阶段产物）
  // 加在这里，并同步 parseState / normalize / visibility 三处。deadlineAt
  // 是阶段截止的底盘字段：null 表示本阶段无截止，非 null 时到期由
  // phase.expire / phase.settleExpired 结算（服务端定时 effect 是正确性路径）。
  | {
      readonly kind: 'playing';
      readonly deadlineAt: number | null;
    }
  | { readonly kind: 'ended' };

export const DEMO_PHASES = ['lobby', 'viewing', 'playing', 'ended'] as const;
export type DemoPhaseKind = (typeof DEMO_PHASES)[number];

export interface DemoHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

/**
 * TODO(gameplay): 发牌产出的占位身份。身份构成（角色表、阵营、人数对应表）是
 * 内容层：把 dealDemoIdentities（domain/rules.ts）换成真实构成后，
 * 身份值的类型也应收紧为本游戏的身份枚举。
 */
export const DEMO_TODO_IDENTITY = 'todo';

export interface DemoState extends BaseGameState<typeof DEMO_GAME_TYPE> {
  readonly phase: DemoPhase;
  readonly phaseRevision: number;
  readonly config: DemoConfig;
  readonly roster: RosterMap<DemoHumanSeat>;
  /** seat -> 身份；发牌后写入，visibility 按查看者裁剪，终局才全公开。 */
  readonly identities: Readonly<Record<number, string>>;
  /** 已查看自己身份的座位（Identity Viewing Protocol）；全员含机器人齐全才能开始。 */
  readonly roleViewedSeats: readonly number[];
  /** 已完成的对局序号（从 0 开始）；每次开局递增，用于结算幂等。 */
  readonly gameSequence: number;
  /** 终局结算 effect 恰好发出一次的标记。 */
  readonly xpSettled: boolean;
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getDemoUserSeat(state: DemoState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

/** Counts occupied seats (real humans plus bots). */
export function getDemoOccupiedSeatCount(state: DemoState): number {
  return countOccupiedSeats(state.roster);
}

/** Seat is playable: occupied by a real human or a bot. */
export function isDemoOccupiedSeat(state: DemoState, seat: number): boolean {
  return state.roster[seat] != null;
}

/** Identity Viewing Protocol participants: every occupied seat with its bot flag. */
export function getDemoViewingParticipants(
  state: DemoState,
): readonly IdentityViewingParticipant[] {
  return buildRosterViewingParticipants(state.roster, state.config.numberOfPlayers);
}

/** Authoritative Avalon （阿瓦隆） state; identity deduction with fixed boards, pure logic without IO. */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import type { SeatOccupant } from '../../../platform/room/seating';

export const AVALON_GAME_TYPE = 'avalon' as const;
export const AVALON_STATE_VERSION = 1;

export const AVALON_MIN_PLAYERS = 5;
export const AVALON_MAX_PLAYERS = 10;

export const AVALON_VETO_LIMIT_MIN = 3;
export const AVALON_VETO_LIMIT_MAX = 5;
export const AVALON_DEFAULT_VETO_LIMIT = 5;

export const AVALON_VOTE_MODES = ['public', 'secret'] as const;
export type AvalonVoteMode = (typeof AVALON_VOTE_MODES)[number];
export const AVALON_DEFAULT_VOTE_MODE: AvalonVoteMode = 'public';

export const AVALON_QUEST_COUNT = 5;
/** 7 人及以上第 4 轮任务需要 2 张失败票才算失败（官方规则）。 */
export const AVALON_FOURTH_QUEST_DOUBLE_FAIL_MIN_PLAYERS = 7;
/** 湖中仙女只在 9/10 人局出现。 */
export const AVALON_LADY_MIN_PLAYERS = 9;
/** 湖中仙女在第 2/3/4 轮任务结算后各查验一次。 */
export const AVALON_LADY_ROUNDS = [2, 3, 4] as const;

export const AVALON_ROLES = [
  'merlin',
  'percival',
  'loyalServant',
  'morgana',
  'assassin',
  'mordred',
  'oberon',
  'minion',
] as const;
export type AvalonRoleId = (typeof AVALON_ROLES)[number];

const AVALON_EVIL_ROLES: readonly AvalonRoleId[] = [
  'morgana',
  'assassin',
  'mordred',
  'oberon',
  'minion',
];

export function isAvalonEvilRole(role: AvalonRoleId): boolean {
  return AVALON_EVIL_ROLES.includes(role);
}

export function isAvalonGoodRole(role: AvalonRoleId): boolean {
  return !isAvalonEvilRole(role);
}

export type AvalonPlayerCount = 5 | 6 | 7 | 8 | 9 | 10;
export const AVALON_PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const;

/** Narrows an untrusted number to a supported player count without assertions. */
export function isAvalonPlayerCount(value: number): value is AvalonPlayerCount {
  return value === 5 || value === 6 || value === 7 || value === 8 || value === 9 || value === 10;
}

/** Narrows an untrusted number to a supported veto limit without assertions. */
export function isAvalonVetoLimit(value: number): value is 3 | 4 | 5 {
  return value === 3 || value === 4 || value === 5;
}

/** Narrows an untrusted string to a supported vote mode without assertions. */
export function isAvalonVoteMode(value: string): value is AvalonVoteMode {
  return value === 'public' || value === 'secret';
}

/**
 * 固定板子（D2）：人数即板子，角色构成与人数严格对应。
 * 忠臣 = 亚瑟的忠臣，爪牙 = 莫德雷德的爪牙；梅林 / 刺客每局必备。
 */
export const AVALON_BOARDS: Record<AvalonPlayerCount, readonly AvalonRoleId[]> = {
  5: ['merlin', 'percival', 'loyalServant', 'morgana', 'assassin'],
  6: ['merlin', 'percival', 'loyalServant', 'loyalServant', 'morgana', 'assassin'],
  7: ['merlin', 'percival', 'loyalServant', 'loyalServant', 'morgana', 'assassin', 'oberon'],
  8: [
    'merlin',
    'percival',
    'loyalServant',
    'loyalServant',
    'loyalServant',
    'morgana',
    'assassin',
    'minion',
  ],
  9: [
    'merlin',
    'percival',
    'loyalServant',
    'loyalServant',
    'loyalServant',
    'loyalServant',
    'morgana',
    'assassin',
    'mordred',
  ],
  10: [
    'merlin',
    'percival',
    'loyalServant',
    'loyalServant',
    'loyalServant',
    'loyalServant',
    'morgana',
    'assassin',
    'oberon',
    'mordred',
  ],
};

/** 任务人数表（官方规则）：人数 → 5 轮各自需要的队员数。 */
export const AVALON_QUEST_SIZES: Record<
  AvalonPlayerCount,
  readonly [number, number, number, number, number]
> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export interface AvalonConfig {
  /** 人数即板子（D6-Q2）。 */
  readonly numberOfPlayers: AvalonPlayerCount;
  /** 组队投票模式：公投 / 暗投，默认公投（D7）；任务出牌永远是暗投。 */
  readonly voteMode: AvalonVoteMode;
  /** 单轮连续否决上限，默认 5（D8）。 */
  readonly vetoLimit: 3 | 4 | 5;
}

export const DEFAULT_AVALON_CONFIG: AvalonConfig = {
  numberOfPlayers: 6,
  voteMode: AVALON_DEFAULT_VOTE_MODE,
  vetoLimit: AVALON_DEFAULT_VETO_LIMIT,
};

/** Checks supported lobby settings without replacing invalid values. */
export function isValidAvalonConfig(config: AvalonConfig): boolean {
  return (
    isAvalonPlayerCount(config.numberOfPlayers) &&
    isAvalonVoteMode(config.voteMode) &&
    isAvalonVetoLimit(config.vetoLimit)
  );
}

export type AvalonQuestRound = 1 | 2 | 3 | 4 | 5;
export const AVALON_QUEST_ROUNDS = [1, 2, 3, 4, 5] as const;

/** Narrows an untrusted number to a quest round without assertions. */
export function isAvalonQuestRound(value: number): value is AvalonQuestRound {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export type AvalonNightStep = 'evilReveal' | 'merlinReveal' | 'percivalReveal';
export const AVALON_NIGHT_STEPS: readonly AvalonNightStep[] = [
  'evilReveal',
  'merlinReveal',
  'percivalReveal',
];

export type AvalonBallot = 'approve' | 'reject';
export const AVALON_BALLOTS = ['approve', 'reject'] as const;

export type AvalonPlay = 'success' | 'fail';
export const AVALON_PLAYS = ['success', 'fail'] as const;

/**
 * 终局原因：'threeSuccess' 在设计草案中与 'assassinationMiss'
 * 描述同一结局（3 成功后刺杀未命中 → 好人胜），此处只保留更具体的
 * 'assassinationMiss'，避免不可达的枚举分支。
 */
export type AvalonEndReason =
  | 'threeFail'
  | 'vetoLimitReached'
  | 'assassinationHit'
  | 'assassinationMiss'
  | 'earlyAssassinationHit'
  | 'earlyAssassinationMiss';
export const AVALON_END_REASONS = [
  'threeFail',
  'vetoLimitReached',
  'assassinationHit',
  'assassinationMiss',
  'earlyAssassinationHit',
  'earlyAssassinationMiss',
] as const;

export type AvalonPhase =
  | { readonly kind: 'lobby' }
  | {
      readonly kind: 'night';
      readonly step: AvalonNightStep;
      readonly confirmedSeats: readonly number[];
    }
  | {
      readonly kind: 'nominate';
      readonly round: AvalonQuestRound;
      readonly requiredSize: number;
    }
  | {
      readonly kind: 'vote';
      readonly round: AvalonQuestRound;
      readonly proposedSeats: readonly number[];
      readonly ballots: Readonly<Record<number, AvalonBallot>>;
    }
  | {
      readonly kind: 'quest';
      readonly round: AvalonQuestRound;
      readonly teamSeats: readonly number[];
      /** 结算前不向他人揭晓个人选择。 */
      readonly plays: Readonly<Record<number, AvalonPlay>>;
      /** 通过的组队投票结果，随任务结算写入历史记录。 */
      readonly ballots: Readonly<Record<number, AvalonBallot>>;
      readonly approveCount: number;
      readonly rejectCount: number;
      readonly abstainCount: number;
    }
  | {
      readonly kind: 'lady';
      readonly afterRound: 2 | 3 | 4;
      readonly holderSeat: number;
      /** 当过湖仙的 seat（含首任持有人），不可再被查验。 */
      readonly examinedSeats: readonly number[];
      readonly targetSeat: number | null;
    }
  | { readonly kind: 'assassin'; readonly accusedSeat: number | null }
  | {
      readonly kind: 'ended';
      readonly winner: 'good' | 'evil';
      readonly reason: AvalonEndReason;
      readonly accusedSeat: number | null;
    };

export const AVALON_PHASES = [
  'lobby',
  'night',
  'nominate',
  'vote',
  'quest',
  'lady',
  'assassin',
  'ended',
] as const;
export type AvalonPhaseKind = (typeof AVALON_PHASES)[number];

/** 开局发牌时服务端算好的可见集合；全量广播，客户端按 myRole 裁剪（D6-Q1）。 */
export interface AvalonNightInfo {
  /** seat -> 互认的坏人 seats；奥伯伦对应空数组（互不可见）。 */
  readonly evilPeers: Readonly<Record<number, readonly number[]>>;
  /** 梅林看到的坏人 seats（不含莫德雷德）。 */
  readonly merlinSees: readonly number[];
  /** 派西维尔看到的梅林 + 莫甘娜 seats（分不清谁是谁）。 */
  readonly percivalSees: readonly number[];
}

/** 每轮历史记录：队长 / 队员 / 投票结果 / 任务结果。 */
export interface AvalonQuestHistoryEntry {
  readonly round: AvalonQuestRound;
  readonly leaderSeat: number;
  readonly teamSeats: readonly number[];
  readonly ballots: Readonly<Record<number, AvalonBallot>>;
  readonly approveCount: number;
  readonly rejectCount: number;
  readonly abstainCount: number;
  readonly result: 'success' | 'fail';
  readonly successCount: number;
  readonly failCount: number;
}

/** 最近一次湖仙查验结果；只对查验时的持有人可见（view model 裁剪）。 */
export interface AvalonLadyCheckResult {
  readonly holderSeat: number;
  readonly targetSeat: number;
  readonly faction: 'good' | 'evil';
}

/**
 * 最近一次组队投票结算结果（设计稿 §7 投票结算面板）。
 * team.proposed 后清零；vetoLimitReached 时 rejectStreak 记为否决上限。
 */
export interface AvalonLastVoteResult {
  /** 赞成 > 反对则为 true。 */
  readonly approved: boolean;
  /** 结算后的连续被否决次数（通过时为 0）。 */
  readonly rejectStreak: number;
  readonly ballots: Readonly<Record<number, AvalonBallot>>;
  readonly approveCount: number;
  readonly rejectCount: number;
  readonly abstainCount: number;
}

export interface AvalonHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface AvalonState extends BaseGameState<typeof AVALON_GAME_TYPE> {
  readonly phase: AvalonPhase;
  readonly phaseRevision: number;
  readonly config: AvalonConfig;
  readonly realSeats: Readonly<Record<number, AvalonHumanSeat | undefined>>;
  /** 大厅房主点了"填充机器人"后为 true；配置页无此开关（D9）。 */
  readonly fillEmptySeatsWithBots: boolean;
  /** 房主显式踢掉的隐式机器人席位。 */
  readonly excludedBotSeats: readonly number[];
  /** seat -> 角色；公开广播，UI 按 myRole 过滤（D6-Q1）。 */
  readonly roles: Readonly<Record<number, AvalonRoleId>>;
  readonly nightInfo: AvalonNightInfo;
  /** 当前队长 seat；lobby 时为 -1。 */
  readonly leaderSeat: number;
  /** 本轮已否决次数；组队通过后清零。 */
  readonly rejectStreak: number;
  readonly questResults: ReadonlyArray<'success' | 'fail'>;
  readonly questHistory: readonly AvalonQuestHistoryEntry[];
  /** 9/10 人局的湖仙 token 持有人；其余为 null。 */
  readonly ladyHolderSeat: number | null;
  readonly ladyExaminedSeats: readonly number[];
  readonly lastLadyCheck: AvalonLadyCheckResult | null;
  /** 最近一次组队投票结算（投票结算面板用）；新一轮提案后清零。 */
  readonly lastVoteResult: AvalonLastVoteResult | null;
  /** 已完成的对局序号（从 0 开始）；每次开局递增，用于结算幂等。 */
  readonly gameSequence: number;
  /** winner 结算幂等标记：growth settlement effect 恰好触发一次。 */
  readonly xpSettled: boolean;
}

export function getAvalonBotDisplayName(seat: number): string {
  return `机器人${seat + 1}号`;
}

/** 隐式机器人席位：点了填充机器人、无真人入座、未被踢掉的空座。 */
export function isAvalonImplicitBotSeat(state: AvalonState, seat: number): boolean {
  return (
    state.fillEmptySeatsWithBots &&
    Number.isSafeInteger(seat) &&
    seat >= 0 &&
    seat < state.config.numberOfPlayers &&
    state.realSeats[seat] === undefined &&
    !state.excludedBotSeats.includes(seat)
  );
}

/** Counts real humans only (excludes implicit bot seats). */
export function getAvalonRealHumanCount(state: AvalonState): number {
  return Object.values(state.realSeats).filter((seat) => seat !== undefined).length;
}

/** Counts real humans plus implicit bot seats (occupied seats for display). */
export function getAvalonOccupiedSeatCount(state: AvalonState): number {
  let count = getAvalonRealHumanCount(state);
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (isAvalonImplicitBotSeat(state, seat)) count += 1;
  }
  return count;
}

/** Seat is playable: a real human or an implicit bot seat. */
export function isAvalonOccupiedSeat(state: AvalonState, seat: number): boolean {
  return state.realSeats[seat] !== undefined || isAvalonImplicitBotSeat(state, seat);
}

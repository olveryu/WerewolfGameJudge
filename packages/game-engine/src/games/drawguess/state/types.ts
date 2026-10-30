/** Authoritative DrawGuess (经典你画我猜) state; Gartic-style draw-and-guess, pure logic without IO. */

import type { GameConfigSchema } from '../../../platform/config/configSchema';
import { isValidConfig } from '../../../platform/config/configSchema';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  getHumanSeatMap,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';

export const DRAWGUESS_GAME_TYPE = 'drawguess' as const;
/** v2 replaces realSeats plus the implicit-bot derivation inputs (the fill
 * flag lived inside the config) with the unified roster. v1 payloads
 * migrate through migratePersistedDrawGuessState. */

export const DRAWGUESS_MIN_PLAYERS = 4;
export const DRAWGUESS_MAX_PLAYERS = 12;
const DRAWGUESS_DEFAULT_PLAYERS = 6;

export const DRAWGUESS_DRAWING_DURATION_SECONDS = 90;
export const DRAWGUESS_ROUNDS_PER_DRAWER = 2;
export const DRAWGUESS_WORD_SELECT_SECONDS = 15;
export const DRAWGUESS_ROUND_END_SECONDS = 8;
export const DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS = 20;
export const DRAWGUESS_WORD_CHOICE_COUNT = 3;

export const DRAWGUESS_GUESS_BASE_SCORE = 50;
export const DRAWGUESS_GUESS_SPEED_BONUS_MAX = 100;
/** 画手每被一人猜中，按该猜中者得分的这一比例即时加分。 */
export const DRAWGUESS_DRAWER_SHARE = 0.5;
/** 首个猜中后，剩余作画时间压缩到至多这么多秒。 */
export const DRAWGUESS_FIRST_GUESS_REMAINING_CAP_SECONDS = 30;
/** 除画手外全部席位猜中后，剩余作画时间压缩到至多这么多秒。 */
export const DRAWGUESS_ALL_GUESSED_REMAINING_SECONDS = 3;
export const DRAWGUESS_MAX_STROKES_PER_TURN = 300;
export const DRAWGUESS_GUESS_TEXT_MAX_LENGTH = 32;

export const DRAWGUESS_PHASES = ['lobby', 'wordSelect', 'drawing', 'roundEnd', 'ended'] as const;
export type DrawGuessPhaseKind = (typeof DRAWGUESS_PHASES)[number];

/** 词语分类：只收适合绘画的内容；供词链路按分类轮询生成。 */
export const DRAWGUESS_WORD_CATEGORIES = [
  'animals',
  'food',
  'dailyObjects',
  'plants',
  'vehicles',
  'places',
  'sports',
  'people',
  'idioms',
  'internetMemes',
] as const;
export type DrawGuessWordCategory = (typeof DRAWGUESS_WORD_CATEGORIES)[number];

export interface DrawGuessConfig {
  readonly numberOfPlayers: number;
  readonly drawingDurationSeconds: typeof DRAWGUESS_DRAWING_DURATION_SECONDS;
  readonly roundsPerDrawer: typeof DRAWGUESS_ROUNDS_PER_DRAWER;
  readonly wordSelectSeconds: typeof DRAWGUESS_WORD_SELECT_SECONDS;
  readonly roundEndSeconds: typeof DRAWGUESS_ROUND_END_SECONDS;
  readonly hintRevealIntervalSeconds: typeof DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS;
}

export const DEFAULT_DRAWGUESS_CONFIG: DrawGuessConfig = {
  numberOfPlayers: DRAWGUESS_DEFAULT_PLAYERS,
  drawingDurationSeconds: DRAWGUESS_DRAWING_DURATION_SECONDS,
  roundsPerDrawer: DRAWGUESS_ROUNDS_PER_DRAWER,
  wordSelectSeconds: DRAWGUESS_WORD_SELECT_SECONDS,
  roundEndSeconds: DRAWGUESS_ROUND_END_SECONDS,
  hintRevealIntervalSeconds: DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
};

export const DRAWGUESS_CONFIG_SCHEMA: GameConfigSchema<DrawGuessConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      min: DRAWGUESS_MIN_PLAYERS,
      max: DRAWGUESS_MAX_PLAYERS,
    },
    drawingDurationSeconds: { kind: 'fixed', value: DRAWGUESS_DRAWING_DURATION_SECONDS },
    roundsPerDrawer: { kind: 'fixed', value: DRAWGUESS_ROUNDS_PER_DRAWER },
    wordSelectSeconds: { kind: 'fixed', value: DRAWGUESS_WORD_SELECT_SECONDS },
    roundEndSeconds: { kind: 'fixed', value: DRAWGUESS_ROUND_END_SECONDS },
    hintRevealIntervalSeconds: { kind: 'fixed', value: DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS },
  },
  defaults: DEFAULT_DRAWGUESS_CONFIG,
  validate: () => null,
};

export interface DrawGuessHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

/** 候选词：服务端从 drawguess_words 表随机取 3 个未用过的词。 */
export interface DrawGuessWordChoice {
  readonly word: string;
  readonly pinyinInitials: string;
}

export interface DrawGuessPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 整笔数据模型（从接龙版 pictionaryDrawing.ts 复制概念，游戏间禁止互相 import）。
 * 坐标归一化到 0–1；导出时映射到 1024×768。
 */
export type DrawGuessStroke =
  | {
      readonly id: string;
      readonly kind: 'brush' | 'eraser';
      readonly color: string;
      readonly width: number;
      readonly points: readonly DrawGuessPoint[];
      readonly authorSeat: number;
    }
  | {
      readonly id: string;
      readonly kind: 'line' | 'rectangle' | 'ellipse';
      readonly color: string;
      readonly width: number;
      readonly start: DrawGuessPoint;
      readonly end: DrawGuessPoint;
      readonly authorSeat: number;
    }
  | {
      readonly id: string;
      readonly kind: 'fill';
      readonly color: string;
      readonly width: number;
      readonly rectangles: ReadonlyArray<{
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }>;
      readonly authorSeat: number;
    };

export interface DrawGuessGuessLogEntry {
  readonly seat: number;
  readonly text: string;
  readonly correct: boolean;
  readonly at: number;
}

export interface DrawGuessMedia {
  readonly objectKey: string;
  readonly contentType: 'image/png';
  readonly width: 1024;
  readonly height: 768;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface DrawGuessDrawingReservation {
  readonly submissionId: string;
  readonly entryId: string;
  readonly authorSeat: number;
  readonly turnIndex: number;
  readonly reservedAt: number;
}

export type DrawGuessPhase =
  | { readonly kind: 'lobby' }
  | {
      readonly kind: 'wordSelect';
      readonly drawerSeat: number;
      /** 选词中为空数组（服务端正在出题），出题完成后填入 3 个候选。 */
      readonly choices: readonly DrawGuessWordChoice[];
      /** 出题完成前为 null；出题完成后为出题时刻 + wordSelectSeconds。 */
      readonly deadlineAt: number | null;
    }
  | {
      readonly kind: 'drawing';
      readonly drawerSeat: number;
      /** 仅画手可见，见 visibility 裁剪。 */
      readonly word: string;
      /** 与 word 等长；猜题者只能看到按进度揭示的展示串。 */
      readonly pinyinInitials: string;
      /** 首字母揭示顺序（字符索引），由 randomSeed 生成。 */
      readonly revealOrder: readonly number[];
      readonly strokes: readonly DrawGuessStroke[];
      /** 已猜中锁定的席位（D5）。 */
      readonly guessedSeats: readonly number[];
      readonly guessLog: readonly DrawGuessGuessLogEntry[];
      /** 本轮各席位得分（猜中者+画手），结算时复制到 roundScores。 */
      readonly turnScores: Readonly<Record<number, number>>;
      readonly phaseStartAt: number;
      /** 猜中会压缩截止时间；速度分与首字母揭示均以 phaseStartAt 为基准，不受影响。 */
      readonly deadlineAt: number;
    }
  | {
      readonly kind: 'roundEnd';
      readonly drawerSeat: number;
      readonly word: string;
      /** 保留用于结算展示，下一回合清空。 */
      readonly strokes: readonly DrawGuessStroke[];
      readonly roundScores: Readonly<Record<number, number>>;
      readonly pngEntry: DrawGuessMedia | null;
      readonly reservation: DrawGuessDrawingReservation | null;
      readonly deadlineAt: number;
    }
  | {
      readonly kind: 'ended';
      readonly totalScores: Readonly<Record<number, number>>;
    };

export interface DrawGuessState extends BaseGameState<typeof DRAWGUESS_GAME_TYPE> {
  readonly phase: DrawGuessPhase;
  readonly phaseRevision: number;
  readonly config: DrawGuessConfig;
  readonly roster: RosterMap<DrawGuessHumanSeat>;
  /** 座位升序的画手轮换队列（含隐式机器人席位），开局时生成。 */
  readonly drawerQueue: readonly number[];
  /** 当前第几回合（从 0 开始），总回合数 = drawerQueue.length × roundsPerDrawer。 */
  readonly turnIndex: number;
  /** seat -> 总分。 */
  readonly scores: Readonly<Record<number, number>>;
  /** 本局已用题目，避免重复出题。 */
  readonly usedWords: readonly string[];
  /** 已完成的对局序号（从 0 开始）；每次开局递增，用于结算幂等。 */
  readonly gameSequence: number;
}

/** Checks supported lobby settings without replacing invalid values. */
export function isValidDrawGuessConfig(config: DrawGuessConfig): boolean {
  return isValidConfig(DRAWGUESS_CONFIG_SCHEMA, config);
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getDrawGuessUserSeat(state: DrawGuessState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

/** Counts real humans only (excludes bot seats). */
export function getDrawGuessRealHumanCount(state: DrawGuessState): number {
  return Object.keys(getHumanSeatMap(state.roster, state.config.numberOfPlayers)).length;
}

/** Counts every occupied seat (real humans plus bots). */
export function getDrawGuessOccupiedSeatCount(state: DrawGuessState): number {
  return countOccupiedSeats(state.roster);
}

/** Total turns in a game: every drawer (including implicit bots) draws roundsPerDrawer times. */
export function getDrawGuessTotalTurns(state: DrawGuessState): number {
  return state.drawerQueue.length * state.config.roundsPerDrawer;
}

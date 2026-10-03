/** Authoritative DrawGuess (经典你画我猜) state; Gartic-style draw-and-guess, pure logic without IO. */

import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import type { SeatOccupant } from '../../../platform/room/seating';

export const DRAWGUESS_GAME_TYPE = 'drawguess' as const;
export const DRAWGUESS_STATE_VERSION = 1;

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
export const DRAWGUESS_DRAWER_PER_GUESS_SCORE = 20;
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
  readonly fillEmptySeatsWithBots: boolean;
}

export const DEFAULT_DRAWGUESS_CONFIG: DrawGuessConfig = {
  numberOfPlayers: DRAWGUESS_DEFAULT_PLAYERS,
  drawingDurationSeconds: DRAWGUESS_DRAWING_DURATION_SECONDS,
  roundsPerDrawer: DRAWGUESS_ROUNDS_PER_DRAWER,
  wordSelectSeconds: DRAWGUESS_WORD_SELECT_SECONDS,
  roundEndSeconds: DRAWGUESS_ROUND_END_SECONDS,
  hintRevealIntervalSeconds: DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  fillEmptySeatsWithBots: false,
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
  readonly realSeats: Readonly<Record<number, DrawGuessHumanSeat | undefined>>;
  /** 房主显式踢掉的隐式机器人席位。 */
  readonly excludedBotSeats: readonly number[];
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
  return (
    Number.isSafeInteger(config.numberOfPlayers) &&
    config.numberOfPlayers >= DRAWGUESS_MIN_PLAYERS &&
    config.numberOfPlayers <= DRAWGUESS_MAX_PLAYERS &&
    config.drawingDurationSeconds === DRAWGUESS_DRAWING_DURATION_SECONDS &&
    config.roundsPerDrawer === DRAWGUESS_ROUNDS_PER_DRAWER &&
    config.wordSelectSeconds === DRAWGUESS_WORD_SELECT_SECONDS &&
    config.roundEndSeconds === DRAWGUESS_ROUND_END_SECONDS &&
    config.hintRevealIntervalSeconds === DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS &&
    typeof config.fillEmptySeatsWithBots === 'boolean'
  );
}

export function getDrawGuessBotDisplayName(seat: number): string {
  return `机器人${seat + 1}号`;
}

/** 隐式机器人席位：开了补机器人开关、无真人入座、未被踢掉的空座。 */
export function isDrawGuessImplicitBotSeat(state: DrawGuessState, seat: number): boolean {
  return (
    state.config.fillEmptySeatsWithBots &&
    Number.isSafeInteger(seat) &&
    seat >= 0 &&
    seat < state.config.numberOfPlayers &&
    state.realSeats[seat] === undefined &&
    !state.excludedBotSeats.includes(seat)
  );
}

/** Counts real humans only (excludes implicit bot seats). */
export function getDrawGuessRealHumanCount(state: DrawGuessState): number {
  return Object.values(state.realSeats).filter((seat) => seat !== undefined).length;
}

/** Counts real humans plus implicit bot seats (occupied seats for display). */
export function getDrawGuessOccupiedSeatCount(state: DrawGuessState): number {
  let count = getDrawGuessRealHumanCount(state);
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (isDrawGuessImplicitBotSeat(state, seat)) count += 1;
  }
  return count;
}

/** Total turns in a game: every drawer (including implicit bots) draws roundsPerDrawer times. */
export function getDrawGuessTotalTurns(state: DrawGuessState): number {
  return state.drawerQueue.length * state.config.roundsPerDrawer;
}

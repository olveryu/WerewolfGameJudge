/** DrawGuess pure game rules: scoring, guess normalization, hint reveal. No IO. */

import { createSeededRng, shuffleArray } from '../../../platform/random';
import {
  DRAWGUESS_ALL_GUESSED_REMAINING_SECONDS,
  DRAWGUESS_DRAWER_SHARE,
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_FIRST_GUESS_REMAINING_CAP_SECONDS,
  DRAWGUESS_GUESS_BASE_SCORE,
  DRAWGUESS_GUESS_SPEED_BONUS_MAX,
  DRAWGUESS_GUESS_TEXT_MAX_LENGTH,
  type DrawGuessWordChoice,
} from '../state/types';

/**
 * 猜词归一化（中文规则）：去除所有空白字符（含全角空格）、剥离 CJK 标点、
 * 全角 ASCII 转半角。本游戏仅支持简体中文，V1 不做繁简映射。
 */
export function normalizeGuessText(text: string): string {
  return (
    text
      // 全角 ASCII（含全角空格 U+3000 先转半角空格）转半角
      .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/\u3000/g, ' ')
      // 剥离 CJK 标点与 ASCII 标点
      .replace(/[\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F!-/:-@[-`{-~]/g, '')
      // 去除所有空白
      .replace(/\s+/g, '')
  );
}

/** 服务端权威判定：归一化后必须与答案完全一致。 */
export function isCorrectGuess(text: string, answer: string): boolean {
  const normalized = normalizeGuessText(text);
  return normalized.length > 0 && normalized === normalizeGuessText(answer);
}

export function isValidGuessText(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.length > 0 &&
    text.length <= DRAWGUESS_GUESS_TEXT_MAX_LENGTH &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001F\u007F]/.test(text)
  );
}

/**
 * 猜中者得分：20 + round(180 × 剩余毫秒 / 90000)。
 * 开局即猜中得 200 分，压哨猜中得 20 分。
 * remainingMs 来自 computeScoringRemainingMs（作画开始时刻为基准），
 * 猜中压缩 deadline 不影响后续猜中者的速度分。
 */
export function computeGuesserScore(remainingMs: number): number {
  const clamped = Math.max(0, remainingMs);
  return (
    DRAWGUESS_GUESS_BASE_SCORE +
    Math.round(
      (DRAWGUESS_GUESS_SPEED_BONUS_MAX * clamped) / (DRAWGUESS_DRAWING_DURATION_SECONDS * 1000),
    )
  );
}

/** 速度分基准剩余毫秒：完整作画时长减去已进行时间，与被压缩的 deadlineAt 无关。 */
export function computeScoringRemainingMs(phaseStartAt: number, nowMs: number): number {
  return phaseStartAt + DRAWGUESS_DRAWING_DURATION_SECONDS * 1000 - nowMs;
}

/**
 * 画手每被一人猜中即时所得：round(该猜中者得分 × 0.5)。
 * 作画收入占整局总分比例恒为 SHARE / (1 + SHARE)，与房间人数无关。
 */
export function computeDrawerScore(guesserScore: number): number {
  return Math.round(Math.max(0, guesserScore) * DRAWGUESS_DRAWER_SHARE);
}

/**
 * 猜中后的作画截止时间（只缩短，不延长）：
 * 首个猜中 → 剩余至多 30 秒；除画手外全部席位猜中 → 剩余至多 3 秒。
 */
export function computeDeadlineAfterGuess(
  deadlineAt: number,
  nowMs: number,
  guessedCount: number,
  guesserCount: number,
): number {
  let next = deadlineAt;
  if (guessedCount === 1) {
    next = Math.min(next, nowMs + DRAWGUESS_FIRST_GUESS_REMAINING_CAP_SECONDS * 1000);
  }
  if (guessedCount >= guesserCount) {
    next = Math.min(next, nowMs + DRAWGUESS_ALL_GUESSED_REMAINING_SECONDS * 1000);
  }
  return next;
}

/** 首字母揭示顺序：用 randomSeed 洗牌，保证所有客户端一致、重连不重新随机。 */
export function createRevealOrder(wordLength: number, randomSeed: string): readonly number[] {
  const indices = Array.from({ length: wordLength }, (_, index) => index);
  return shuffleArray(indices, createSeededRng(`${randomSeed}:drawguess-reveal`));
}

/**
 * 已揭示首字母数量：min(floor(已进行毫秒 / 20000), 字数)。
 * 首字母可全部揭示（仍需结合画作推理，不直接泄露答案）。
 */
export function computeRevealedCount(
  phaseStartAt: number,
  nowMs: number,
  hintRevealIntervalSeconds: number,
  wordLength: number,
): number {
  if (nowMs < phaseStartAt) return 0;
  return Math.min(
    Math.floor((nowMs - phaseStartAt) / (hintRevealIntervalSeconds * 1000)),
    wordLength,
  );
}

/** 猜题者看到的提示串，如 "d x m"。首字母串按空格切分（zh/ch/sh 是双字母）。 */
export function buildHintText(
  pinyinInitials: string,
  revealOrder: readonly number[],
  revealedCount: number,
): string {
  const revealed = new Set(revealOrder.slice(0, revealedCount));
  return pinyinInitials
    .split(' ')
    .map((initial, index) => (revealed.has(index) ? initial : '_'))
    .join(' ');
}

/** 校验服务端下发的候选词：3 个不重复的简体词，首字母段数与字数相等。 */
export function isValidWordChoice(choice: DrawGuessWordChoice): boolean {
  const initials =
    typeof choice.pinyinInitials === 'string' ? choice.pinyinInitials.split(' ') : [];
  return (
    typeof choice.word === 'string' &&
    choice.word.length >= 1 &&
    choice.word.length <= 8 &&
    initials.length === choice.word.length &&
    initials.every((part) => /^[a-z]+$/.test(part))
  );
}

/** DrawGuess per-seat view model: the answer never leaves the server for guessers. */

import {
  type DrawGuessHumanSeat,
  type DrawGuessPhaseKind,
  type DrawGuessState,
  getDrawGuessBotDisplayName,
  isDrawGuessImplicitBotSeat,
} from '../state/types';
import { buildHintText, computeRevealedCount } from './rules';

export interface DrawGuessSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isDrawer: boolean;
  readonly isLocked: boolean;
  readonly score: number;
}

export interface DrawGuessGuessMessage {
  readonly seat: number;
  readonly displayName: string;
  /** 猜中者的原文被隐藏，客户端渲染为"xxx 猜中了"。 */
  readonly text: string | null;
  readonly correct: boolean;
  readonly at: number;
}

export interface DrawGuessViewModel {
  readonly phase: DrawGuessPhaseKind;
  readonly seats: readonly DrawGuessSeatView[];
  readonly drawerSeat: number | null;
  /** 仅画手可见；其他人为空。 */
  readonly word: string | null;
  /** 仅画手在 wordSelect 可见的候选词；其他人为空数组。 */
  readonly choices: readonly string[];
  /** 猜题者看到的提示串，如 "3个字 · d _ m"；画手为 null。 */
  readonly hintText: string | null;
  readonly wordLength: number;
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly roundScores: Readonly<Record<number, number>> | null;
  readonly totalScores: Readonly<Record<number, number>>;
  readonly turnLabel: string;
  readonly deadlineAt: number | null;
  readonly scores: Readonly<Record<number, number>>;
}

function seatDisplayName(state: DrawGuessState, seat: number): string {
  const occupant: DrawGuessHumanSeat | undefined = state.realSeats[seat];
  if (occupant !== undefined) return occupant.profile.displayName;
  return getDrawGuessBotDisplayName(seat);
}

function buildSeatViews(state: DrawGuessState, drawerSeat: number | null): DrawGuessSeatView[] {
  const views: DrawGuessSeatView[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    const isReal = state.realSeats[seat] !== undefined;
    const isBot = isDrawGuessImplicitBotSeat(state, seat);
    if (!isReal && !isBot) continue;
    const guessed = state.phase.kind === 'drawing' && state.phase.guessedSeats.includes(seat);
    views.push({
      seat,
      displayName: seatDisplayName(state, seat),
      isBot,
      isDrawer: drawerSeat === seat,
      isLocked: guessed,
      score: state.scores[seat] ?? 0,
    });
  }
  return views;
}

function guessMessages(
  state: DrawGuessState,
  viewerSeat: number | null,
  isDrawer: boolean,
): DrawGuessGuessMessage[] {
  if (state.phase.kind !== 'drawing') return [];
  return state.phase.guessLog.map((entry) => ({
    seat: entry.seat,
    displayName: seatDisplayName(state, entry.seat),
    text: entry.correct && !isDrawer && entry.seat !== viewerSeat ? null : entry.text,
    correct: entry.correct,
    at: entry.at,
  }));
}

/**
 * Builds the cropped view model for one viewer.
 * @param viewerSeat Seat of the viewer; null for spectators without a seat.
 * @param nowMs Client/server time used to derive the hint reveal progress.
 */
export function getDrawGuessViewModel(
  state: DrawGuessState,
  viewerSeat: number | null,
  nowMs: number,
): DrawGuessViewModel {
  const phase = state.phase;
  const drawerSeat =
    phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd'
      ? phase.drawerSeat
      : null;
  const isDrawer = viewerSeat !== null && viewerSeat === drawerSeat;

  let word: string | null = null;
  let choices: readonly string[] = [];
  let hintText: string | null = null;
  let wordLength = 0;
  let deadlineAt: number | null = null;

  if (phase.kind === 'wordSelect') {
    deadlineAt = phase.deadlineAt;
    if (isDrawer) choices = phase.choices.map((choice) => choice.word);
  } else if (phase.kind === 'drawing') {
    deadlineAt = phase.deadlineAt;
    wordLength = phase.word.length;
    if (isDrawer) {
      word = phase.word;
    } else {
      const revealedCount = computeRevealedCount(
        phase.phaseStartAt,
        nowMs,
        state.config.hintRevealIntervalSeconds,
        phase.word.length,
      );
      const initials = buildHintText(phase.pinyinInitials, phase.revealOrder, revealedCount);
      hintText = `${phase.word.length}个字 · ${initials}`;
    }
  } else if (phase.kind === 'roundEnd') {
    deadlineAt = phase.deadlineAt;
    word = phase.word;
    wordLength = phase.word.length;
  } else if (phase.kind === 'ended') {
    wordLength = 0;
  }

  const totalTurns = state.drawerQueue.length * state.config.roundsPerDrawer;
  const turnLabel =
    phase.kind === 'lobby' ? '等待开始' : `第 ${state.turnIndex + 1} / ${totalTurns} 轮`;

  return {
    phase: phase.kind,
    seats: buildSeatViews(state, drawerSeat),
    drawerSeat,
    word,
    choices,
    hintText,
    wordLength,
    messages: guessMessages(state, viewerSeat, isDrawer),
    roundScores: phase.kind === 'roundEnd' ? phase.roundScores : null,
    totalScores: phase.kind === 'ended' ? phase.totalScores : state.scores,
    turnLabel,
    deadlineAt,
    scores: state.scores,
  };
}

/**
 * The DrawGuess review document: the final standings, then one page per
 * finished turn — its drawing, its facts and the order the word was
 * guessed in.
 *
 * Every fact comes from the ended state: the engine's final totals and
 * its turn history (`DrawGuessTurnRecord`). The standings rank through the
 * one competition ranking the in-room board uses; scores, the bot tag and
 * the all-guessed note reuse the game's own copy.
 */

import {
  type DrawGuessState,
  type DrawGuessTurnRecord,
  isBotOccupant,
  isBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewBlock,
  ReviewImageLoadResult,
  ReviewLabeledValue,
  ReviewScoreRow,
  ReviewStamp,
  ReviewTimelineStep,
  RoomReviewDocument,
  RoomReviewPage,
} from '@/features/room/review/types';

import {
  DRAWGUESS_BOT_TAG,
  DRAWGUESS_DRAWER_ZEROED_DETAIL,
  DRAWGUESS_DRAWER_ZEROED_TITLE,
  formatDrawGuessScore,
  rankDrawGuessScores,
} from '../model/drawGuessResults';

const STANDINGS_LABEL = '最终排名';
const GUESS_ORDER_TITLE = '猜中顺序';
const MISSING_DRAWING = '未提交画作';
/** Seats ranked this high are stamped under the hero, ties included. */
const STAMP_RANK_LIMIT = 3;

/** Loads one filed drawing by its media entry id. */
export type DrawGuessDrawingLoader = (
  entryId: string,
  signal: AbortSignal,
) => Promise<ReviewImageLoadResult>;

type EndedPhase = Extract<DrawGuessState['phase'], { readonly kind: 'ended' }>;

interface Standing {
  readonly seat: number;
  readonly name: string;
  readonly isBot: boolean;
  readonly totalScore: number;
  readonly rank: number;
}

/** A seated player's display name; every seat of a finished game is occupied. */
function seatName(state: DrawGuessState, seat: number): string {
  const occupant = state.roster[seat];
  if (occupant == null) {
    throw new Error(`[FAIL-FAST] DrawGuess review seat ${seat} is empty`);
  }
  return isBotOccupant(occupant) ? getBotDisplayName(seat) : occupant.profile.displayName;
}

function rankStandings(state: DrawGuessState, phase: EndedPhase): readonly Standing[] {
  const entries = Array.from({ length: state.config.numberOfPlayers }, (_, seat) => ({
    seat,
    name: seatName(state, seat),
    isBot: isBotSeat(state.roster, seat),
    // The engine's totals list only seats that scored; every other seat finished on 0.
    totalScore: phase.totalScores[seat] ?? 0,
  }));
  return rankDrawGuessScores(entries);
}

function standingsPage(standings: readonly Standing[], isOnlyPage: boolean): RoomReviewPage {
  const leaders = standings.filter((standing) => standing.rank === 1);
  const stamps: ReviewStamp[] = standings
    .filter((standing) => standing.rank <= STAMP_RANK_LIMIT)
    .map((standing) => ({
      seat: standing.seat,
      tone: 'highlight',
      title: standing.name,
      caption: `第 ${standing.rank} 名`,
      note: formatDrawGuessScore(standing.totalScore),
    }));
  const rows: ReviewScoreRow[] = standings.map((standing) => ({
    rank: standing.rank,
    seat: standing.seat,
    name: standing.name,
    scoreText: formatDrawGuessScore(standing.totalScore),
    tag: standing.isBot ? { text: DRAWGUESS_BOT_TAG, tone: 'muted' } : null,
  }));
  return {
    key: 'standings',
    label: isOnlyPage ? null : STANDINGS_LABEL,
    blocks: [
      {
        kind: 'hero',
        headline: [
          { kind: 'text', text: `第一名 ${leaders.map((leader) => leader.name).join('、')}` },
        ],
        tone: 'highlight',
        stamps,
        byline: null,
      },
      { kind: 'scoreboard', rows },
    ],
  };
}

function drawingBlock(
  turn: DrawGuessTurnRecord,
  drawerName: string,
  loadDrawing: DrawGuessDrawingLoader,
): ReviewBlock {
  const { entryId, pngEntry } = turn;
  const caption = `${drawerName}的终稿`;
  if (entryId === null) {
    return { kind: 'paragraph', caption, text: MISSING_DRAWING, isMissing: true };
  }
  if (pngEntry === null) {
    throw new Error(`[FAIL-FAST] DrawGuess turn ${turn.turnIndex} drawing ${entryId} has no media`);
  }
  return {
    kind: 'image',
    assetId: entryId,
    caption,
    aspectRatio: pngEntry.width / pngEntry.height,
    load: (signal) => loadDrawing(entryId, signal),
  };
}

function turnFacts(turn: DrawGuessTurnRecord, drawerName: string): readonly ReviewLabeledValue[] {
  const facts: ReviewLabeledValue[] = [
    { label: '题目', value: turn.word },
    { label: '画手', value: drawerName },
    { label: '猜中人数', value: `${turn.guessedSeats.length} 人` },
  ];
  if (turn.drawerZeroed) {
    facts.push({ label: DRAWGUESS_DRAWER_ZEROED_TITLE, value: DRAWGUESS_DRAWER_ZEROED_DETAIL });
  }
  return facts;
}

function guessOrderSteps(
  state: DrawGuessState,
  turn: DrawGuessTurnRecord,
): readonly ReviewTimelineStep[] {
  return turn.guessedSeats.map((seat) => {
    const score = turn.roundScores[seat];
    if (score === undefined) {
      throw new Error(`[FAIL-FAST] DrawGuess turn ${turn.turnIndex} guesser ${seat} has no score`);
    }
    return {
      title: null,
      tone: 'good',
      lines: [
        [
          { kind: 'seat', seat, tone: 'good' },
          { kind: 'text', text: seatName(state, seat), tone: 'neutral' },
          { kind: 'text', text: ` +${formatDrawGuessScore(score)}`, tone: 'good' },
        ],
      ],
    };
  });
}

function turnPage(
  state: DrawGuessState,
  turn: DrawGuessTurnRecord,
  loadDrawing: DrawGuessDrawingLoader,
): RoomReviewPage {
  const drawerName = seatName(state, turn.drawerSeat);
  const blocks: ReviewBlock[] = [
    drawingBlock(turn, drawerName, loadDrawing),
    { kind: 'facts', items: turnFacts(turn, drawerName) },
  ];
  if (turn.guessedSeats.length > 0) {
    blocks.push(
      { kind: 'section', title: GUESS_ORDER_TITLE },
      { kind: 'timeline', steps: guessOrderSteps(state, turn) },
    );
  }
  return {
    key: `turn-${turn.turnIndex}`,
    label: `第 ${turn.turnIndex + 1} 轮 · ${drawerName} 画「${turn.word}」`,
    blocks,
  };
}

/** Builds the review of an ended DrawGuess game. */
export function toDrawGuessReviewDocument(input: {
  readonly state: DrawGuessState;
  readonly roomCode: string;
  readonly loadDrawing: DrawGuessDrawingLoader;
}): RoomReviewDocument {
  const { state, roomCode, loadDrawing } = input;
  const { phase } = state;
  if (phase.kind !== 'ended') {
    throw new Error(`[FAIL-FAST] DrawGuess review built during ${phase.kind}`);
  }
  const turnPages = state.turnHistory.map((turn) => turnPage(state, turn, loadDrawing));
  return {
    roundKey: `game-${state.gameSequence}`,
    kicker: `🎨 第 ${state.gameSequence} 局 · 终局`,
    fileStem: `drawguess-${roomCode}-${state.gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: false,
    pages: [standingsPage(rankStandings(state, phase), turnPages.length === 0), ...turnPages],
  };
}

/** DrawGuess decision outcomes and permission gates; no IO. */

import {
  type ActorResolution,
  type CommandContext,
  commit,
  type Decision,
} from '../../../platform/engine';
import type { GameCompletionPayload } from '../../../platform/engine/completionEffect';
import { resolveActingSeat } from '../../../platform/room/actingSeat';
import { type RosterChange } from '../../../platform/room/seating';
import type { DrawGuessCompletionPayload } from '../publicStats';
import type {
  DrawGuessMedia,
  DrawGuessReaction,
  DrawGuessStroke,
  DrawGuessWordChoice,
} from '../state/types';
import { type DrawGuessHumanSeat, type DrawGuessState } from '../state/types';

export const DRAWGUESS_REASONS = {
  config: 'drawguess_config_invalid',
  phase: 'drawguess_phase_invalid',
  stale: 'drawguess_stale_round',
  expired: 'drawguess_round_expired',
  notSeated: 'drawguess_not_seated',
  notDrawer: 'drawguess_not_drawer',
  notGuesser: 'drawguess_not_guesser',
  locked: 'drawguess_round_locked',
  emptyChoices: 'drawguess_empty_choices',
  invalidWord: 'drawguess_invalid_word',
  invalidStroke: 'drawguess_invalid_stroke',
  strokeLimit: 'drawguess_stroke_limit_reached',
  invalidGuess: 'drawguess_invalid_guess',
  wordsDealt: 'drawguess_words_dealt',
  reservation: 'drawguess_reservation_invalid',
  full: 'drawguess_room_not_full',
  occupied: 'drawguess_occupied_seat_out_of_range',
  deadline: 'drawguess_deadline_not_reached',
  rateLimited: 'drawguess_rate_limited',
  reaction: 'drawguess_reaction_invalid',
  reactionAlreadySent: 'drawguess_reaction_already_sent',
  reactionSelf: 'drawguess_reaction_self',
} as const;

export type DrawGuessEvent =
  | {
      readonly type: 'drawguess.seats.changed';
      readonly changes: readonly RosterChange<DrawGuessHumanSeat>[];
    }
  | { readonly type: 'drawguess.config.updated'; readonly config: DrawGuessState['config'] }
  | {
      readonly type: 'drawguess.game.started';
      readonly drawerQueue: readonly number[];
      readonly drawerSeat: number;
    }
  | {
      readonly type: 'drawguess.turn.started';
      readonly turnIndex: number;
      readonly drawerSeat: number;
    }
  | {
      readonly type: 'drawguess.words.dealt';
      readonly turnIndex: number;
      readonly choices: readonly DrawGuessWordChoice[];
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.word.chosen';
      readonly turnIndex: number;
      readonly word: string;
      readonly pinyinInitials: string;
      readonly revealOrder: readonly number[];
      readonly phaseStartAt: number;
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.stroke.added';
      readonly turnIndex: number;
      readonly stroke: DrawGuessStroke;
    }
  | { readonly type: 'drawguess.stroke.undone'; readonly turnIndex: number }
  | { readonly type: 'drawguess.strokes.cleared'; readonly turnIndex: number }
  | {
      readonly type: 'drawguess.guess.submitted';
      readonly turnIndex: number;
      readonly seat: number;
      readonly text: string;
      readonly correct: boolean;
      readonly at: number;
      readonly guesserScore: number;
      readonly drawerScore: number;
      /** 本次猜词后的作画截止时间；猜中会压缩，猜错不变。 */
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.reaction.sent';
      readonly turnIndex: number;
      readonly seat: number;
      readonly reaction: DrawGuessReaction;
    }
  | {
      readonly type: 'drawguess.round.ended';
      readonly turnIndex: number;
      readonly drawerSeat: number;
      readonly word: string;
      readonly deadlineAt: number;
    }
  | {
      readonly type: 'drawguess.drawing.reserved';
      readonly turnIndex: number;
      readonly submissionId: string;
      readonly entryId: string;
      readonly authorSeat: number;
      readonly reservedAt: number;
    }
  | {
      readonly type: 'drawguess.drawing.committed';
      readonly turnIndex: number;
      readonly pngEntry: DrawGuessMedia;
    }
  | {
      readonly type: 'drawguess.game.ended';
      readonly totalScores: Readonly<Record<number, number>>;
    }
  | { readonly type: 'drawguess.game.returnedToLobby' };

export type DrawGuessEffect =
  | { readonly type: 'drawguess.words.deal'; readonly payload: { readonly turnIndex: number } }
  | DrawGuessRecordSeenWordEffect
  | {
      readonly type: 'drawguess.game.completed';
      readonly payload: GameCompletionPayload | DrawGuessCompletionPayload;
    }
  | DrawGuessSettleDueEffect;

/** The word chosen for a turn, with the accounts at the table that now count as having seen it. */
type DrawGuessRecordSeenWordEffect = {
  readonly type: 'drawguess.word.recordSeen';
  readonly payload: {
    readonly gameSequence: number;
    readonly turnIndex: number;
    readonly word: string;
    readonly participantUserIds: readonly string[];
  };
};

/** Scheduled settle effect: pins the exact arming (game, phase identity, deadline) the Worker delivery must still match to settle. */
export type DrawGuessSettleDueEffect = {
  readonly type: 'drawguess.settle.due';
  readonly payload: {
    readonly gameSequence: number;
    readonly phaseRevision: number;
    readonly turnIndex: number;
    readonly deadlineAt: number;
  };
};

export type DrawGuessDecision = Decision<DrawGuessEvent, DrawGuessEffect>;

/** Commits domain events and word-dealing effects through the shared runtime. */
export function commitDrawGuess(
  events: readonly DrawGuessEvent[],
  effects: readonly DrawGuessEffect[] = [],
): DrawGuessDecision {
  return commit({ events, effects });
}

/** Resolves the acting seat for guess submission (never the drawer). */
export function resolveDrawGuessGuesser(
  state: DrawGuessState,
  context: CommandContext,
  drawerSeat: number,
): ActorResolution<number> {
  const resolved = resolveActingSeat(state, state.config.numberOfPlayers, context);
  if (resolved.kind === 'rejected') return resolved;
  return resolved.value === drawerSeat
    ? { kind: 'rejected', reason: DRAWGUESS_REASONS.notGuesser }
    : resolved;
}

/** Guards lobby-only commands. */

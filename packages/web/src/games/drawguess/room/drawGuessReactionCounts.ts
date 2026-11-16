import type {
  DrawGuessReaction,
  DrawGuessTurnRecord,
} from '@game-judge/game-engine/games/drawguess/public';

export interface DrawGuessReactionCounts {
  readonly flower: number;
  readonly egg: number;
  readonly tomato: number;
}

export const EMPTY_DRAWGUESS_REACTION_COUNTS: DrawGuessReactionCounts = {
  flower: 0,
  egg: 0,
  tomato: 0,
};

/** Counts reactions received by the drawer in one turn, keyed by their sender seats. */
export function countDrawGuessRoundReactionReceipts(
  reactionsBySeat: Readonly<Record<number, DrawGuessReaction>>,
): DrawGuessReactionCounts {
  const counts = { ...EMPTY_DRAWGUESS_REACTION_COUNTS };
  for (const reaction of Object.values(reactionsBySeat)) {
    counts[reaction] += 1;
  }
  return counts;
}

/** Aggregates every completed turn's reactions by the seat that received them. */
export function countDrawGuessReactionReceiptsByDrawer(
  turns: readonly Pick<DrawGuessTurnRecord, 'drawerSeat' | 'reactionsBySeat'>[],
): Readonly<Record<number, DrawGuessReactionCounts>> {
  const countsByDrawer: Record<number, DrawGuessReactionCounts> = {};
  for (const turn of turns) {
    const previous = countsByDrawer[turn.drawerSeat] ?? EMPTY_DRAWGUESS_REACTION_COUNTS;
    const received = countDrawGuessRoundReactionReceipts(turn.reactionsBySeat);
    countsByDrawer[turn.drawerSeat] = {
      flower: previous.flower + received.flower,
      egg: previous.egg + received.egg,
      tomato: previous.tomato + received.tomato,
    };
  }
  return countsByDrawer;
}

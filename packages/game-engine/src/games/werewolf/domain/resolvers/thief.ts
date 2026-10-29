/**
 * Thief Resolver (SERVER-ONLY, pure function)
 *
 * Responsibilities: validate deck-card pick + enforce must-pick-wolf-if-present + write thiefChosenCard.
 * Thief acts before all other roles; picks one of two deck cards as their identity.
 * If any wolf-faction card is among the deck cards, thief must pick the wolf-faction card.
 * No IO (network / audio / Alert).
 */

import { getBottomCardCountForRole } from '../models';
import { rejectBottomCardChoice } from './bottomCardChoice';
import type { ResolverFn } from './types';

/** Must pick a deck card */
const REJECT_MUST_CHOOSE = '必须选择一张底牌' as const;

/** cardIndex out of range */
const REJECT_INVALID_INDEX = '无效的卡牌索引' as const;

export const thiefChooseResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults, bottomCardContext } = context;
  const cardIndex = input.cardIndex;

  // Nightmare block → skip allowed
  if (cardIndex === undefined || cardIndex === null) {
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true };
    }
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE };
  }

  // Context must exist (reuses bottomCardContext infra)
  if (!bottomCardContext) {
    throw new Error('[FAIL-FAST] Thief resolver requires bottomCardContext');
  }

  const { bottomCards } = bottomCardContext;
  const bottomCardCount = getBottomCardCountForRole('thief');

  if (bottomCards.length !== bottomCardCount) {
    throw new Error(
      `[FAIL-FAST] Thief requires ${bottomCardCount} bottom cards, received ${bottomCards.length}`,
    );
  }

  // Validate index range
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= bottomCardCount) {
    return { valid: false, rejectReason: REJECT_INVALID_INDEX };
  }

  const chosenRoleId = bottomCards[cardIndex];
  if (chosenRoleId === undefined) {
    throw new Error('[FAIL-FAST] Valid thief card index resolved to no card');
  }

  const choiceReason = rejectBottomCardChoice('thief', bottomCards, chosenRoleId);
  if (choiceReason !== null) {
    return { valid: false, rejectReason: choiceReason };
  }

  return {
    valid: true,
    updates: {
      thiefChosenCard: chosenRoleId,
    },
  };
};

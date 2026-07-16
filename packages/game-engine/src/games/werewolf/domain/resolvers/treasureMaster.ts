/**
 * TreasureMaster Resolver (SERVER-ONLY, pure function)
 *
 * Responsibility: validate the deck-card choice and write treasureMasterChosenCard.
 * treasureMaster acts before all roles, choosing one of the three deck cards as their own identity (god or villager card, wolf cards not allowed).
 * S21 rule: deck cards are fixed at 1 regular wolf + 1 God + 1 Villager (no skill wolves); permanent wolf faction, does not meet the wolf team, does not participate in killing.
 * Contains no IO (network / audio / Alert).
 */

import { getBottomCardCountForRole, ROLE_SPECS } from '../models';
import { Faction } from '../models/roles/spec/types';
import type { ResolverFn } from './types';

/** Must choose a deck card */
const REJECT_MUST_CHOOSE = '必须选择一张底牌' as const;

/** cardIndex out of range */
const REJECT_INVALID_INDEX = '无效的卡牌索引' as const;

/** Wolf-faction deck card not selectable */
const REJECT_WOLF_CARD = '不可选择狼人阵营底牌' as const;

export const treasureMasterChooseResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults, bottomCardContext } = context;
  const cardIndex = input.cardIndex;

  // Nightmare block -> skip allowed
  if (cardIndex === undefined || cardIndex === null) {
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true };
    }
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE };
  }

  // Context must exist
  if (!bottomCardContext) {
    throw new Error('[FAIL-FAST] Treasure master resolver requires bottomCardContext');
  }

  const { bottomCards } = bottomCardContext;
  const bottomCardCount = getBottomCardCountForRole('treasureMaster');

  if (bottomCards.length !== bottomCardCount) {
    throw new Error(
      `[FAIL-FAST] Treasure master requires ${bottomCardCount} bottom cards, received ${bottomCards.length}`,
    );
  }

  // Validate index range
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= bottomCardCount) {
    return { valid: false, rejectReason: REJECT_INVALID_INDEX };
  }

  // Get the chosen role
  const chosenRoleId = bottomCards[cardIndex];
  if (chosenRoleId === undefined) {
    throw new Error('[FAIL-FAST] Valid treasure-master card index resolved to no card');
  }

  // Reject wolf-faction card selection
  const chosenSpec = ROLE_SPECS[chosenRoleId];
  if (chosenSpec.faction === Faction.Wolf) {
    return { valid: false, rejectReason: REJECT_WOLF_CARD };
  }

  return {
    valid: true,
    updates: {
      treasureMasterChosenCard: chosenRoleId,
    },
  };
};

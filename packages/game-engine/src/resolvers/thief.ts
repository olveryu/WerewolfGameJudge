/**
 * Thief Resolver (SERVER-ONLY, pure function)
 *
 * Responsibilities: validate deck-card pick + enforce must-pick-wolf-if-present + write thiefChosenCard.
 * Thief acts before all other roles; picks one of two deck cards as their identity.
 * If any wolf-faction card is among the deck cards, thief must pick the wolf-faction card.
 * No IO (network / audio / Alert).
 */

import { ROLE_SPECS, type RoleId } from '../models';
import { Faction } from '../models/roles/spec/types';
import type { ResolverFn } from './types';

/** Number of deck cards (thief is fixed at 2) */
const THIEF_BOTTOM_CARD_COUNT = 2;

/** Must pick a deck card */
const REJECT_MUST_CHOOSE = '必须选择一张底牌' as const;

/** cardIndex out of range */
const REJECT_INVALID_INDEX = '无效的卡牌索引' as const;

/** Must pick wolf card when a wolf-faction card is among the deck cards */
const REJECT_MUST_CHOOSE_WOLF = '底牌中有狼人阵营的牌，必须选择狼人' as const;

/** Missing thief context */
const REJECT_NO_CONTEXT = '缺少盗贼上下文' as const;

function isWolfFaction(roleId: RoleId): boolean {
  return ROLE_SPECS[roleId].faction === Faction.Wolf;
}

export const thiefChooseResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults, bottomCardContext } = context;
  const cardIndex = input.cardIndex;

  // Nightmare block → skip allowed
  if (cardIndex === undefined || cardIndex === null) {
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true, result: {} };
    }
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE };
  }

  // Context must exist (reuses bottomCardContext infra)
  if (!bottomCardContext) {
    return { valid: false, rejectReason: REJECT_NO_CONTEXT };
  }

  const { bottomCards } = bottomCardContext;

  // Validate index range
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= THIEF_BOTTOM_CARD_COUNT) {
    return { valid: false, rejectReason: REJECT_INVALID_INDEX };
  }

  const chosenRoleId = bottomCards[cardIndex]!;

  // Check: if any bottom card is wolf faction, player MUST choose a wolf card
  const hasWolfCard = bottomCards.some((r) => isWolfFaction(r));
  if (hasWolfCard && !isWolfFaction(chosenRoleId)) {
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE_WOLF };
  }

  return {
    valid: true,
    updates: {
      thiefChosenCard: chosenRoleId,
      bottomCardStepRoles: [...bottomCards],
    },
    result: {},
  };
};

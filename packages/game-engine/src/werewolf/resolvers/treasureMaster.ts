/**
 * TreasureMaster Resolver (SERVER-ONLY, pure function)
 *
 * Responsibility: validate deck card choice + compute effectiveTeam + write treasureMasterChosenCard.
 * treasureMaster acts before all roles, choosing one of the three deck cards as their own identity (god or villager card, wolf cards not allowed).
 * S21 rule: deck cards are fixed at 1 regular wolf + 1 God + 1 Villager (no skill wolves); permanent wolf faction, does not meet the wolf team, does not participate in killing.
 * Contains no IO (network / audio / Alert).
 */

import { BOTTOM_CARD_COUNT, ROLE_SPECS, type RoleId } from '../models';
import { Faction, Team } from '../models/roles/spec/types';
import type { ResolverFn } from './types';

/** Must choose a deck card */
const REJECT_MUST_CHOOSE = '必须选择一张底牌' as const;

/** cardIndex out of range */
const REJECT_INVALID_INDEX = '无效的卡牌索引' as const;

/** Missing treasureMaster context */
const REJECT_NO_CONTEXT = '缺少盗宝大师上下文' as const;

/** Wolf-faction deck card not selectable */
const REJECT_WOLF_CARD = '不可选择狼人阵营底牌' as const;

/**
 * Compute effective team from bottom card composition.
 *
 * Rules:
 * - Any wolf-faction card in bottom -> Team.Wolf
 * - No wolf, 2+ god -> Team.Good
 * - No wolf, 2+ villager -> Team.Good
 * - Otherwise -> Team.Good (default to good side)
 */
export function computeEffectiveTeam(bottomCards: readonly RoleId[]): Team {
  const factions = bottomCards.map((r) => ROLE_SPECS[r].faction);

  if (factions.some((f) => f === Faction.Wolf)) {
    return Team.Wolf;
  }

  // No wolf — determine by majority faction
  const godCount = factions.filter((f) => f === Faction.God).length;
  if (godCount >= 2) return Team.Good;

  const villagerCount = factions.filter((f) => f === Faction.Villager).length;
  if (villagerCount >= 2) return Team.Good;

  // Mixed composition (e.g. 1 god + 1 villager + 1 special) -> default good
  return Team.Good;
}

export const treasureMasterChooseResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults, bottomCardContext } = context;
  const cardIndex = input.cardIndex;

  // Nightmare block -> skip allowed
  if (cardIndex === undefined || cardIndex === null) {
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true, result: {} };
    }
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE };
  }

  // Context must exist
  if (!bottomCardContext) {
    return { valid: false, rejectReason: REJECT_NO_CONTEXT };
  }

  const { bottomCards } = bottomCardContext;

  // Validate index range
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= BOTTOM_CARD_COUNT) {
    return { valid: false, rejectReason: REJECT_INVALID_INDEX };
  }

  // Get the chosen role
  const chosenRoleId = bottomCards[cardIndex]!;

  // Reject wolf-faction card selection
  const chosenSpec = ROLE_SPECS[chosenRoleId];
  if (chosenSpec.faction === Faction.Wolf) {
    return { valid: false, rejectReason: REJECT_WOLF_CARD };
  }

  // Compute effective team from all bottom cards
  const effectiveTeam = computeEffectiveTeam(bottomCards);

  return {
    valid: true,
    result: {},
    updates: {
      treasureMasterChosenCard: chosenRoleId,
      effectiveTeam,
      bottomCardStepRoles: [...bottomCards],
    },
  };
};

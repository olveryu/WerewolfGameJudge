/**
 * Thief Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验底牌选择 + 强制有狼必选狼 + 写入 thiefChosenCard。
 * thief 先于所有角色行动，从底牌两张中选择一张作为自身身份。
 * 底牌中有狼队伍牌时必须选择狼队伍牌。
 * 不包含 IO（网络 / 音频 / Alert）。
 */

import { ROLE_SPECS, type RoleId } from '../models';
import { Faction } from '../models/roles/spec/types';
import type { ResolverFn } from './types';

/** 底牌张数（thief 固定 2） */
const THIEF_BOTTOM_CARD_COUNT = 2;

/** 必须选择一张底牌 */
const REJECT_MUST_CHOOSE = '必须选择一张底牌' as const;

/** cardIndex 超出范围 */
const REJECT_INVALID_INDEX = '无效的卡牌索引' as const;

/** 底牌中有狼人阵营的牌时必须选择狼人 */
const REJECT_MUST_CHOOSE_WOLF = '底牌中有狼人阵营的牌，必须选择狼人' as const;

/** 缺少盗贼上下文 */
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

  const chosenRoleId = bottomCards[cardIndex];

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

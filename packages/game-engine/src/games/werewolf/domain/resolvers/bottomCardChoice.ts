/**
 * Bottom-card choice rules — the one place the thief / treasureMaster card
 * legality lives. The resolvers reject an illegal pick with these reasons;
 * the view-model projection renders the same cards disabled with the same
 * reasons before the pick is attempted. No IO.
 */

import { ROLE_SPECS, type RoleId } from '../models';
import { Faction } from '../models/roles/spec/types';

/** Thief must pick the wolf card when a wolf-faction card is among the deck cards. */
export const BOTTOM_CARD_REJECT_MUST_CHOOSE_WOLF = '底牌中有狼人阵营的牌，必须选择狼人' as const;

/** Treasure master may never pick a wolf-faction card. */
export const BOTTOM_CARD_REJECT_WOLF_CARD = '不可选择狼人阵营底牌' as const;

export type BottomCardChooserRole = 'thief' | 'treasureMaster';

export interface BottomCardOption {
  readonly roleId: RoleId;
  readonly isSelectable: boolean;
  /** The resolver's rejection reason for this card; null when selectable. */
  readonly reason: string | null;
}

export interface BottomCardChoice {
  readonly cards: readonly BottomCardOption[];
  /** One-line summary of the deck's faction composition shown above the cards. */
  readonly hint: string;
}

export function isWolfFactionRole(roleId: RoleId): boolean {
  return ROLE_SPECS[roleId].faction === Faction.Wolf;
}

/** Reason the resolver would reject `chosen` from `bottomCards`, or null when legal. */
export function rejectBottomCardChoice(
  chooser: BottomCardChooserRole,
  bottomCards: readonly RoleId[],
  chosen: RoleId,
): string | null {
  if (chooser === 'thief') {
    const hasWolfCard = bottomCards.some(isWolfFactionRole);
    return hasWolfCard && !isWolfFactionRole(chosen) ? BOTTOM_CARD_REJECT_MUST_CHOOSE_WOLF : null;
  }
  return isWolfFactionRole(chosen) ? BOTTOM_CARD_REJECT_WOLF_CARD : null;
}

/** Every deck card with its legality, as the chooser sees it. */
export function evaluateBottomCardChoice(
  chooser: BottomCardChooserRole,
  bottomCards: readonly RoleId[],
): BottomCardChoice {
  const cards = bottomCards.map((roleId) => {
    const reason = rejectBottomCardChoice(chooser, bottomCards, roleId);
    return { roleId, isSelectable: reason === null, reason };
  });
  const hasWolfCard = bottomCards.some(isWolfFactionRole);
  const hint =
    chooser === 'thief'
      ? hasWolfCard
        ? '底牌含狼人阵营'
        : '底牌均为好人阵营'
      : '你的阵营：狼人阵营';
  return { cards, hint };
}

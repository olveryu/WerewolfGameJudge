/**
 * bottomCardChoice — the one bottom-card legality rule shared by the thief /
 * treasureMaster resolvers (rejection) and the view-model projection
 * (pre-rendered disabled cards). Both sides must agree card for card.
 */

import { describe, expect, it } from 'vitest';

import {
  BOTTOM_CARD_REJECT_MUST_CHOOSE_WOLF,
  BOTTOM_CARD_REJECT_WOLF_CARD,
  evaluateBottomCardChoice,
  isWolfFactionRole,
  rejectBottomCardChoice,
} from '../bottomCardChoice';

describe('bottomCardChoice', () => {
  it('classifies wolf-faction roles', () => {
    expect(isWolfFactionRole('wolf')).toBe(true);
    expect(isWolfFactionRole('darkWolfKing')).toBe(true);
    expect(isWolfFactionRole('seer')).toBe(false);
    expect(isWolfFactionRole('villager')).toBe(false);
  });

  describe('thief', () => {
    it('must take a wolf card when the deck holds one', () => {
      expect(rejectBottomCardChoice('thief', ['wolf', 'seer'], 'seer')).toBe(
        BOTTOM_CARD_REJECT_MUST_CHOOSE_WOLF,
      );
      expect(rejectBottomCardChoice('thief', ['wolf', 'seer'], 'wolf')).toBeNull();
    });

    it('may take any card when the deck holds no wolf', () => {
      expect(rejectBottomCardChoice('thief', ['villager', 'seer'], 'seer')).toBeNull();
      expect(rejectBottomCardChoice('thief', ['villager', 'seer'], 'villager')).toBeNull();
    });

    it('evaluates the deck with the hint the chooser reads', () => {
      expect(evaluateBottomCardChoice('thief', ['wolf', 'seer'])).toEqual({
        cards: [
          { roleId: 'wolf', isSelectable: true, reason: null },
          { roleId: 'seer', isSelectable: false, reason: BOTTOM_CARD_REJECT_MUST_CHOOSE_WOLF },
        ],
        hint: '底牌含狼人阵营',
      });
      expect(evaluateBottomCardChoice('thief', ['villager', 'seer']).hint).toBe('底牌均为好人阵营');
    });
  });

  describe('treasureMaster', () => {
    it('may never take a wolf card', () => {
      expect(rejectBottomCardChoice('treasureMaster', ['wolf', 'seer'], 'wolf')).toBe(
        BOTTOM_CARD_REJECT_WOLF_CARD,
      );
      expect(rejectBottomCardChoice('treasureMaster', ['wolf', 'seer'], 'seer')).toBeNull();
    });

    it('evaluates the deck with the wolf-team hint', () => {
      expect(evaluateBottomCardChoice('treasureMaster', ['wolf', 'seer'])).toEqual({
        cards: [
          { roleId: 'wolf', isSelectable: false, reason: BOTTOM_CARD_REJECT_WOLF_CARD },
          { roleId: 'seer', isSelectable: true, reason: null },
        ],
        hint: '你的阵营：狼人阵营',
      });
    });
  });
});

/**
 * quickQuestions.test - Unit tests for generateQuickQuestions
 *
 * Verifies the pure function that generates 6 contextual quick questions
 * based on game state and player seat.
 */

import type { GameState, Player } from '@game-judge/game-engine/games/werewolf/public';

import { generateQuickQuestions } from '@/games/werewolf/components/AIChatBubble/quickQuestions';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return buildWerewolfTestState({ players: {}, templateRoles: [], ...overrides });
}

function makePlayer(seat: number, role: Player['role']): Player {
  return { seat, role };
}

describe('generateQuickQuestions', () => {
  it('returns exactly 6 general questions when no state', () => {
    const qs = generateQuickQuestions(null, null);
    expect(qs).toHaveLength(6);
    qs.forEach((q) => expect(q.length).toBeGreaterThan(0));
  });

  it('includes "本局角色技能介绍？" when templateRoles present', () => {
    const state = makeState({ templateRoles: ['wolf', 'seer', 'villager'] });
    const qs = generateQuickQuestions(state, null);
    expect(qs).toContain('本局角色技能介绍？');
    expect(qs).toHaveLength(6);
  });

  it('includes role-specific questions when player has a role', () => {
    const state = makeState({
      templateRoles: ['wolf', 'seer'],
      players: { 1: makePlayer(1, 'wolf') },
    });

    // Run multiple times to account for randomness
    for (let i = 0; i < 20; i++) {
      const qs = generateQuickQuestions(state, 1);
      expect(qs).toHaveLength(6);
      expect(qs).toContain('本局角色技能介绍？');
    }
  });

  it('returns 6 unique questions (no duplicates)', () => {
    const state = makeState({
      templateRoles: ['wolf', 'seer'],
      players: { 2: makePlayer(2, 'seer') },
    });

    const qs = generateQuickQuestions(state, 2);
    expect(qs).toHaveLength(6);
    expect(new Set(qs).size).toBe(6);
  });

  it('handles empty templateRoles with player role', () => {
    const state = makeState({ players: { 0: makePlayer(0, 'witch') } });

    const qs = generateQuickQuestions(state, 0);
    expect(qs).toHaveLength(6);
    expect(qs).not.toContain('本局角色技能介绍？');
  });

  it('fills every slot from the general pool without a template or role', () => {
    expect(generateQuickQuestions(makeState(), null)).toHaveLength(6);
  });
});

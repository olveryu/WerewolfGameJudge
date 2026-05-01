/**
 * quickQuestions.test - Unit tests for generateQuickQuestions
 *
 * Verifies the pure function that generates 6 contextual quick questions
 * based on game state and player seat.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState, Player } from '@werewolf/game-engine/protocol/types';

import { generateQuickQuestions } from '@/components/AIChatBubble/quickQuestions';

function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'night',
    currentStep: null,
    players: {},
    templateRoles: [],
    wolfVotes: {},
    lastNightDeaths: [],
    ...overrides,
  } as unknown as GameState;
}

describe('generateQuickQuestions', () => {
  it('returns exactly 6 questions when no state', () => {
    const qs = generateQuickQuestions(null, null);
    expect(qs).toHaveLength(6);
    qs.forEach((q) => expect(typeof q).toBe('string'));
  });

  it('returns general questions when no game state', () => {
    const qs = generateQuickQuestions(null, null);
    expect(qs).toHaveLength(6);
    // All should be from GENERAL_QUESTIONS pool (non-empty strings ≤10 chars)
    qs.forEach((q) => expect(q.length).toBeGreaterThan(0));
  });

  it('includes "本局角色技能介绍？" when templateRoles present', () => {
    const state = makeMinimalState({ templateRoles: ['wolf', 'seer', 'villager'] as RoleId[] });
    const qs = generateQuickQuestions(state, null);
    expect(qs).toContain('本局角色技能介绍？');
    expect(qs).toHaveLength(6);
  });

  it('includes role-specific questions when player has a role', () => {
    const state = makeMinimalState({
      templateRoles: ['wolf', 'seer'] as RoleId[],
      players: {
        1: { role: 'wolf', seat: 1 } as unknown as Player,
      },
    });

    // Run multiple times to account for randomness
    const allQuestions = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const qs = generateQuickQuestions(state, 1);
      expect(qs).toHaveLength(6);
      qs.forEach((q) => allQuestions.add(q));
    }

    // Should have at least got the fixed "本局角色技能介绍？" every time
    expect(allQuestions.has('本局角色技能介绍？')).toBe(true);
  });

  it('returns 6 unique questions (no duplicates)', () => {
    const state = makeMinimalState({
      templateRoles: ['wolf', 'seer'] as RoleId[],
      players: {
        2: { role: 'seer', seat: 2 } as unknown as Player,
      },
    });

    const qs = generateQuickQuestions(state, 2);
    expect(qs).toHaveLength(6);
    expect(new Set(qs).size).toBe(6);
  });

  it('handles empty templateRoles with player role', () => {
    const state = makeMinimalState({
      templateRoles: [],
      players: {
        0: { role: 'witch', seat: 0 } as unknown as Player,
      },
    });

    const qs = generateQuickQuestions(state, 0);
    expect(qs).toHaveLength(6);
    // Should NOT contain "本局角色技能介绍？" since templateRoles is empty
    expect(qs).not.toContain('本局角色技能介绍？');
  });

  it('fills remaining slots with general questions', () => {
    // State with no template (no fixed question) and no role → all 6 from general pool
    const state = makeMinimalState({ templateRoles: [] });
    const qs = generateQuickQuestions(state, null);
    expect(qs).toHaveLength(6);
  });

  it('handles role with no defined ROLE_QUESTIONS entry', () => {
    const state = makeMinimalState({
      templateRoles: ['unknownRole' as RoleId],
      players: {
        1: { role: 'unknownRole' as RoleId, seat: 1 } as unknown as Player,
      },
    });

    const qs = generateQuickQuestions(state, 1);
    expect(qs).toHaveLength(6);
  });
});

/**
 * rolePlayGuide.test - Unit tests for buildRolePlayGuidePrompt
 *
 * Verifies the pure function that builds a structured AI prompt
 * for role-specific gameplay guidance.
 */

import { getAllRoleIds } from '@game-judge/game-engine/games/werewolf/public';

import { buildRolePlayGuidePrompt } from '../rolePlayGuide';

describe('buildRolePlayGuidePrompt', () => {
  it('includes the role displayName in the prompt', () => {
    expect(buildRolePlayGuidePrompt('witch')).toContain('女巫');
  });

  it('includes faction information', () => {
    expect(buildRolePlayGuidePrompt('wolf')).toContain('阵营');
  });

  it('includes skill/技能 description', () => {
    expect(buildRolePlayGuidePrompt('guard')).toContain('技能');
  });

  it('includes output requirements section', () => {
    const result = buildRolePlayGuidePrompt('villager');
    expect(result).toContain('[要求]');
    expect(result).toContain('第一夜行动建议');
    expect(result).toContain('白天发言策略');
  });

  it('mentions wolf team disguise advice for wolf faction roles', () => {
    const result = buildRolePlayGuidePrompt('wolf');
    expect(result).toContain('狼人阵营');
    expect(result).toContain('伪装');
  });

  it('generates valid prompts for all registered roles', () => {
    for (const roleId of getAllRoleIds()) {
      expect(buildRolePlayGuidePrompt(roleId).length).toBeGreaterThan(50);
    }
  });
});

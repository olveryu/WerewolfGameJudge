/**
 * rolePlayGuide.test - Unit tests for buildRolePlayGuidePrompt
 *
 * Verifies the pure function that builds a structured AI prompt
 * for role-specific gameplay guidance.
 */

import { getAllRoleIds, type RoleId } from '@werewolf/game-engine/models/roles';

import { buildRolePlayGuidePrompt } from '../rolePlayGuide';

describe('buildRolePlayGuidePrompt', () => {
  it('returns null for an invalid roleId', () => {
    expect(buildRolePlayGuidePrompt('nonExistentRole' as RoleId)).toBeNull();
  });

  it('returns a non-empty string for a valid role', () => {
    const result = buildRolePlayGuidePrompt('seer' as RoleId);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('includes the role displayName in the prompt', () => {
    const result = buildRolePlayGuidePrompt('witch' as RoleId)!;
    // witch displayName is '女巫'
    expect(result).toContain('女巫');
  });

  it('includes faction information', () => {
    const result = buildRolePlayGuidePrompt('wolf' as RoleId)!;
    expect(result).toContain('阵营');
  });

  it('includes skill/技能 description', () => {
    const result = buildRolePlayGuidePrompt('guard' as RoleId)!;
    expect(result).toContain('技能');
  });

  it('includes output requirements section', () => {
    const result = buildRolePlayGuidePrompt('villager' as RoleId)!;
    expect(result).toContain('[要求]');
    expect(result).toContain('第一夜行动建议');
    expect(result).toContain('白天发言策略');
  });

  it('mentions wolf team disguise advice for wolf faction roles', () => {
    const result = buildRolePlayGuidePrompt('wolf' as RoleId)!;
    expect(result).toContain('狼人阵营');
    expect(result).toContain('伪装');
  });

  it('generates valid prompts for all registered roles', () => {
    const allRoles = getAllRoleIds();
    for (const roleId of allRoles) {
      const result = buildRolePlayGuidePrompt(roleId);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(50);
    }
  });
});

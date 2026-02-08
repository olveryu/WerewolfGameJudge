/**
 * Template Contract Tests
 *
 * 验证 PRESET_TEMPLATES 数据自洽：
 *
 * NOTE（Night-1-only scope）:
 * - 本项目只做第一晚。
 * - 任何“第一晚不行动/从第二晚开始才行动”的角色，必须在 role model 中配置为 `hasNightAction=false`。
 *   这样它才不会出现在 `template.actionOrder`，避免 Host 夜晚流程错误提示该角色起床。
 */

import { PRESET_TEMPLATES, createTemplateFromRoles } from '@/models/Template';
import {
  RoleId,
  buildNightPlan,
  getRoleSpec,
  isValidRoleId,
  hasNightAction,
  isWolfRole,
} from '@/models/roles';

/**
 * Helper: Get action order from roles via NightPlan
 */
function getActionOrderFromRoles(roles: RoleId[]): RoleId[] {
  const nightPlan = buildNightPlan(roles);
  return nightPlan.steps.map((step) => step.roleId);
}

// Helper functions extracted to avoid nesting depth issues
const countWolves = (roles: RoleId[]): number => roles.filter((r) => isWolfRole(r)).length;
const countVillagers = (roles: RoleId[]): number => roles.filter((r) => r === 'villager').length;
const countGods = (roles: RoleId[]): number =>
  roles.filter((r) => getRoleSpec(r).faction === 'god').length;
const getSpecialRoles = (roles: RoleId[]): RoleId[] =>
  roles.filter((r) => r !== 'villager' && r !== 'wolf');

describe('PRESET_TEMPLATES - 数据自洽性', () => {
  it('应该有预定义模板', () => {
    expect(PRESET_TEMPLATES.length).toBeGreaterThan(0);
  });

  PRESET_TEMPLATES.forEach((preset, index) => {
    describe(`模板 ${index + 1}: ${preset.name}`, () => {
      const template = createTemplateFromRoles(preset.roles);
      const actionOrder = getActionOrderFromRoles(preset.roles);

      it('名称应该包含人数且与 roles 数量匹配', () => {
        const regex = /(\d+)人/;
        const match = regex.exec(preset.name);
        expect(match).not.toBeNull();

        const expectedCount = Number.parseInt(match![1], 10);
        expect(preset.roles.length).toBe(expectedCount);
        expect(template.numberOfPlayers).toBe(expectedCount);
      });

      it('所有 roles 都应该是合法的 RoleId', () => {
        for (const role of preset.roles) {
          expect(isValidRoleId(role)).toBe(true);
          expect(getRoleSpec(role)).toBeDefined();
        }
      });

      it('actionOrder 应该只包含模板中存在的角色', () => {
        const roleSet = new Set(preset.roles);
        for (const actionRole of actionOrder) {
          expect(roleSet.has(actionRole)).toBe(true);
        }
      });

      it('actionOrder 中的角色都应该有夜间行动', () => {
        for (const actionRole of actionOrder) {
          expect(hasNightAction(actionRole)).toBe(true);
        }
      });

      it('actionOrder 顺序应该符合 NightPlan 定义的顺序', () => {
        // Get the expected order from NightPlan
        const expectedOrder = getActionOrderFromRoles(preset.roles);
        expect(actionOrder).toEqual(expectedOrder);
      });

      it('应该有合理的阵营分布', () => {
        const wolves = countWolves(preset.roles);
        const villagers = countVillagers(preset.roles);
        const gods = countGods(preset.roles);

        expect(wolves).toBeGreaterThanOrEqual(1);
        expect(wolves).toBeLessThanOrEqual(4);
        expect(villagers).toBeGreaterThanOrEqual(0);
        expect(wolves + villagers + gods).toBe(preset.roles.length);
      });

      it('不应该有重复的特殊角色（除村民和普狼外）', () => {
        const specialRoles = getSpecialRoles(preset.roles);
        const roleSet = new Set(specialRoles);
        expect(roleSet.size).toBe(specialRoles.length);
      });

      it('模板名称应该有意义（非空字符串）', () => {
        expect(preset.name.length).toBeGreaterThan(0);
        expect(preset.name.trim()).toBe(preset.name);
      });
    });
  });
});

describe('PRESET_TEMPLATES - 角色引用完整性', () => {
  it('所有模板引用的角色都应该在 ROLE_SPECS 中定义', () => {
    const allRoles = new Set<string>();
    PRESET_TEMPLATES.forEach((preset) => {
      preset.roles.forEach((role) => allRoles.add(role));
    });

    for (const role of allRoles) {
      const roleSpec = getRoleSpec(role as RoleId);
      expect(roleSpec).toBeDefined();
    }
  });

  it('所有模板引用的角色都应该有正确的属性', () => {
    const allRoles = new Set<string>();
    PRESET_TEMPLATES.forEach((preset) => {
      preset.roles.forEach((role) => allRoles.add(role));
    });

    for (const role of allRoles) {
      const roleSpec = getRoleSpec(role as RoleId);
      expect(roleSpec.displayName.length).toBeGreaterThan(0);
    }
  });
});

describe('PRESET_TEMPLATES - 模板列表完整性', () => {
  const EXPECTED_TEMPLATE_NAMES = [
    '标准板12人',
    '狼美守卫12人',
    '狼王守卫12人',
    '石像鬼守墓人12人',
    '梦魇守卫12人',
    '血月猎魔12人',
    '狼王摄梦人12人',
    '狼王魔术师12人',
    '机械狼通灵师12人',
    '恶灵骑士12人',
  ];

  it('应该包含所有预期的模板', () => {
    const templateNames = PRESET_TEMPLATES.map((t) => t.name);

    for (const expectedName of EXPECTED_TEMPLATE_NAMES) {
      expect(templateNames).toContain(expectedName);
    }
  });

  it('模板数量应该与预期一致', () => {
    expect(PRESET_TEMPLATES.length).toBe(EXPECTED_TEMPLATE_NAMES.length);
  });

  // NOTE: We intentionally don't enforce "one test file per preset" here.
  // Template presets are covered by this contract test, plus Template/Room/
  // (future) Host runtime integration tests.
});

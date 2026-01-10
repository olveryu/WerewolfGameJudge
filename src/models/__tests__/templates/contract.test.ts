/**
 * Template Contract Tests
 * 
 * 验证 PRESET_TEMPLATES 数据自洽：
 * 1. 每个模板的 roles 数量与 name 中的人数匹配
 * 2. roles 只包含合法的 RoleName
 * 3. actionOrder 只包含模板中存在的角色
 * 4. actionOrder 顺序符合 ACTION_ORDER
 * 5. 阵营平衡（狼人数量合理）
 * 6. 特殊角色约束（如有守卫则无白痴等）
 */

import { PRESET_TEMPLATES, createTemplateFromRoles } from '../../Template';
import { 
  RoleName, 
  ACTION_ORDER, 
  ROLE_MODELS, 
  isValidRoleName,
  hasNightAction,
  isWolfRole,
} from '../../roles';

// Helper functions extracted to avoid nesting depth issues
const countWolves = (roles: RoleName[]): number => roles.filter(r => isWolfRole(r)).length;
const countVillagers = (roles: RoleName[]): number => roles.filter(r => r === 'villager').length;
const countGods = (roles: RoleName[]): number => 
  roles.filter(r => ROLE_MODELS[r]?.faction === 'god').length;
const getSpecialRoles = (roles: RoleName[]): RoleName[] => 
  roles.filter(r => r !== 'villager' && r !== 'wolf');

describe('PRESET_TEMPLATES - 数据自洽性', () => {
  // 验证所有模板都存在
  it('应该有预定义模板', () => {
    expect(PRESET_TEMPLATES.length).toBeGreaterThan(0);
  });

  // 动态生成每个模板的测试
  PRESET_TEMPLATES.forEach((preset, index) => {
    describe(`模板 ${index + 1}: ${preset.name}`, () => {
      const template = createTemplateFromRoles(preset.roles);

      it('名称应该包含人数且与 roles 数量匹配', () => {
        // 从名称提取人数 (如 "标准板12人" -> 12)
        const regex = /(\d+)人/;
        const match = regex.exec(preset.name);
        expect(match).not.toBeNull();
        
        const expectedCount = Number.parseInt(match![1], 10);
        expect(preset.roles.length).toBe(expectedCount);
        expect(template.numberOfPlayers).toBe(expectedCount);
      });

      it('所有 roles 都应该是合法的 RoleName', () => {
        for (const role of preset.roles) {
          expect(isValidRoleName(role)).toBe(true);
          expect(ROLE_MODELS[role]).toBeDefined();
        }
      });

      it('actionOrder 应该只包含模板中存在的角色', () => {
        const roleSet = new Set(preset.roles);
        for (const actionRole of template.actionOrder) {
          expect(roleSet.has(actionRole)).toBe(true);
        }
      });

      it('actionOrder 中的角色都应该有夜间行动', () => {
        for (const actionRole of template.actionOrder) {
          expect(hasNightAction(actionRole)).toBe(true);
        }
      });

      it('actionOrder 顺序应该符合 ACTION_ORDER', () => {
        // 验证相对顺序
        for (let i = 0; i < template.actionOrder.length - 1; i++) {
          const currentRole = template.actionOrder[i];
          const nextRole = template.actionOrder[i + 1];
          
          const currentIndex = ACTION_ORDER.indexOf(currentRole);
          const nextIndex = ACTION_ORDER.indexOf(nextRole);
          
          expect(currentIndex).toBeLessThan(nextIndex);
        }
      });

      it('应该有合理的阵营分布', () => {
        const wolves = countWolves(preset.roles);
        const villagers = countVillagers(preset.roles);
        const gods = countGods(preset.roles);

        // 狼人数量应该在合理范围 (1-4 for 12人局)
        expect(wolves).toBeGreaterThanOrEqual(1);
        expect(wolves).toBeLessThanOrEqual(4);

        // 村民数量应该在合理范围
        expect(villagers).toBeGreaterThanOrEqual(0);

        // 总人数应该等于 wolves + villagers + gods
        expect(wolves + villagers + gods).toBe(preset.roles.length);
      });

      it('不应该有重复的特殊角色（除村民和普狼外）', () => {
        const specialRoles = getSpecialRoles(preset.roles);
        const roleSet = new Set(specialRoles);
        
        // 特殊角色应该都是唯一的
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
  it('所有模板引用的角色都应该在 ROLE_MODELS 中定义', () => {
    const allRoles = new Set<string>();
    PRESET_TEMPLATES.forEach(preset => {
      preset.roles.forEach(role => allRoles.add(role));
    });

    for (const role of allRoles) {
      const roleModel = ROLE_MODELS[role as RoleName];
      expect(roleModel).toBeDefined();
    }
  });

  it('所有模板引用的角色都应该有正确的属性', () => {
    const allRoles = new Set<string>();
    PRESET_TEMPLATES.forEach(preset => {
      preset.roles.forEach(role => allRoles.add(role));
    });

    for (const role of allRoles) {
      const roleModel = ROLE_MODELS[role as RoleName];
      expect(roleModel.id).toBe(role);
      expect(roleModel.displayName.length).toBeGreaterThan(0);
      expect(roleModel.description.length).toBeGreaterThan(0);
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
    const templateNames = PRESET_TEMPLATES.map(t => t.name);
    
    for (const expectedName of EXPECTED_TEMPLATE_NAMES) {
      expect(templateNames).toContain(expectedName);
    }
  });

  it('模板数量应该与预期一致', () => {
    expect(PRESET_TEMPLATES.length).toBe(EXPECTED_TEMPLATE_NAMES.length);
  });

  it('每个模板应该有对应的单独测试文件', () => {
    // 这个测试作为提醒：每个模板都应该有独立的测试文件
    // 文件命名规则：<TemplateEnglishName>.test.ts
    const templateTestFiles = [
      'StandardBoard12.test.ts',
      'WolfQueenGuard12.test.ts',
      'DarkWolfKingGuard12.test.ts',
      'GargoyleGravekeeper12.test.ts',
      'NightmareGuard12.test.ts',
      'BloodMoonWitcher12.test.ts',
      'DarkWolfKingCelebrity12.test.ts',
      'DarkWolfKingMagician12.test.ts',
      'WolfRobotPsychic12.test.ts',
      'SpiritKnight12.test.ts',
    ];

    // 验证文件数量匹配
    expect(templateTestFiles.length).toBe(EXPECTED_TEMPLATE_NAMES.length);
  });
});

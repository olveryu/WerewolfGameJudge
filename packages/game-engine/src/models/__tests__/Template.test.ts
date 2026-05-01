import { buildNightPlan, type RoleId } from '@werewolf/game-engine/models/roles';
import {
  BOTTOM_CARD_COUNT,
  createCustomTemplate,
  createTemplateFromRoles,
  PRESET_TEMPLATES,
} from '@werewolf/game-engine/models/Template';

/**
 * Helper: Get action order from roles via NightPlan
 * Phase 5: actionOrder is no longer stored in template, it's derived dynamically
 */
function getActionOrderFromRoles(roles: RoleId[]): RoleId[] {
  const nightPlan = buildNightPlan(roles);
  return nightPlan.steps.map((step) => step.roleId);
}

describe('Template - createTemplateFromRoles', () => {
  it('should create template with correct number of players', () => {
    const roles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);

    expect(template.numberOfPlayers).toBe(6);
    expect(template.roles).toEqual(roles);
  });

  it('should not include actionOrder in template (Phase 5)', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createTemplateFromRoles(roles);

    // Phase 5: actionOrder is removed from template
    expect(template).not.toHaveProperty('actionOrder');
  });

  it('action order should be derived from NightPlan', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch', 'villager'];
    const actionOrder = getActionOrderFromRoles(roles);

    // Action order should only include roles with night actions
    expect(actionOrder).toContain('wolf');
    expect(actionOrder).toContain('seer');
    expect(actionOrder).toContain('witch');
    expect(actionOrder).not.toContain('villager'); // villager has no night action
  });

  it('should respect NightPlan-derived order sequence', () => {
    const roles: RoleId[] = ['seer', 'wolf', 'witch', 'guard', 'hunter'];
    const actionOrder = getActionOrderFromRoles(roles);

    // Verify order matches NightPlan-derived order (NIGHT_STEPS)
    // NIGHT_STEPS order: guardProtect -> wolfKill -> witchAction -> hunterConfirm -> seerCheck
    expect(actionOrder).toEqual(['guard', 'wolf', 'witch', 'hunter', 'seer']);
  });

  it('should handle templates with special wolves', () => {
    const roles: RoleId[] = ['wolf', 'wolfQueen', 'seer', 'witch', 'villager', 'villager'];
    const actionOrder = getActionOrderFromRoles(roles);

    expect(actionOrder).toContain('wolf');
    expect(actionOrder).toContain('wolfQueen');
    // wolf should come before wolfQueen per NightPlan order
    const wolfIndex = actionOrder.indexOf('wolf');
    const wolfQueenIndex = actionOrder.indexOf('wolfQueen');
    expect(wolfIndex).toBeLessThan(wolfQueenIndex);
  });

  it('should handle templates with nightmare', () => {
    const roles: RoleId[] = ['wolf', 'nightmare', 'seer', 'witch', 'guard', 'villager'];
    const actionOrder = getActionOrderFromRoles(roles);

    // nightmare should act before wolf
    const nightmareIndex = actionOrder.indexOf('nightmare');
    const wolfIndex = actionOrder.indexOf('wolf');
    expect(nightmareIndex).toBeLessThan(wolfIndex);
  });

  it('should handle templates with magician', () => {
    const roles: RoleId[] = ['wolf', 'magician', 'seer', 'witch', 'villager', 'villager'];
    const actionOrder = getActionOrderFromRoles(roles);

    // magician should act first (swap numbers)
    expect(actionOrder[0]).toBe('magician');
  });
});

describe('Template - createCustomTemplate', () => {
  it('should keep roles in original order (shuffling happens at assignRoles)', () => {
    const roles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    const template = createCustomTemplate([...roles]);

    // Roles should be in the same order as input
    expect(template.roles).toEqual(roles);
  });

  it('should preserve all roles', () => {
    const roles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    const template = createCustomTemplate(roles);

    // Count each role
    const originalCounts = roles.reduce(
      (acc, role) => {
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const templateCounts = template.roles.reduce(
      (acc, role) => {
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(templateCounts).toEqual(originalCounts);
  });

  it('should maintain correct player count', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createCustomTemplate(roles);

    expect(template.numberOfPlayers).toBe(4);
    expect(template.roles.length).toBe(4);
  });

  it('action order derived from NightPlan should include all night-action roles', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'witch', 'guard'];
    const actionOrder = getActionOrderFromRoles(roles);

    // Action order should be based on role presence, not position
    expect(actionOrder).toContain('guard');
    expect(actionOrder).toContain('wolf');
    expect(actionOrder).toContain('witch');
    expect(actionOrder).toContain('seer');
  });
});

describe('Template - PRESET_TEMPLATES', () => {
  it('should have valid player count for all templates', () => {
    PRESET_TEMPLATES.forEach((preset) => {
      expect(preset.roles.length).toBeGreaterThanOrEqual(6);
      expect(preset.roles.length).toBeLessThanOrEqual(12 + BOTTOM_CARD_COUNT);
    });
  });

  it('should have required roles in standard template', () => {
    const standard = PRESET_TEMPLATES.find((t) => t.name === '预女猎白');
    expect(standard).toBeDefined();
    expect(standard!.roles.filter((r) => r === 'villager').length).toBe(4);
    expect(standard!.roles.filter((r) => r === 'wolf').length).toBe(4);
    expect(standard!.roles).toContain('seer');
    expect(standard!.roles).toContain('witch');
    expect(standard!.roles).toContain('hunter');
    expect(standard!.roles).toContain('idiot');
  });

  it('should have valid action order for all presets', () => {
    PRESET_TEMPLATES.forEach((preset) => {
      const actionOrder = getActionOrderFromRoles(preset.roles);

      // Action order should only include roles from the template
      actionOrder.forEach((role) => {
        expect(preset.roles).toContain(role);
      });
    });
  });
});

describe('Template - Action Order Edge Cases (NightPlan-derived)', () => {
  it('should handle empty roles array', () => {
    const template = createTemplateFromRoles([]);
    const actionOrder = getActionOrderFromRoles([]);

    expect(template.numberOfPlayers).toBe(0);
    expect(template.roles).toEqual([]);
    expect(actionOrder).toEqual([]);
  });

  it('should handle all villagers (no night actions)', () => {
    const roles: RoleId[] = ['villager', 'villager', 'villager'];
    const actionOrder = getActionOrderFromRoles(roles);

    expect(actionOrder).toEqual([]);
  });

  it('should handle duplicate roles in action order', () => {
    const roles: RoleId[] = ['wolf', 'wolf', 'wolf', 'seer', 'witch'];
    const actionOrder = getActionOrderFromRoles(roles);

    // wolf should only appear once in action order
    const wolfCount = actionOrder.filter((r) => r === 'wolf').length;
    expect(wolfCount).toBe(1);
  });

  it('should handle all action roles', () => {
    // Template with many action roles
    const roles: RoleId[] = [
      'slacker',
      'wolfRobot',
      'magician',
      'dreamcatcher',
      'gargoyle',
      'nightmare',
      'guard',
      'wolf',
      'wolfQueen',
      'witch',
      'seer',
      'hunter',
    ];
    const actionOrder = getActionOrderFromRoles(roles);

    // All should be in action order
    expect(actionOrder.length).toBe(12);
  });
});

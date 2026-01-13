import {
  createCustomTemplate,
  createTemplateFromRoles,
  templateHasSkilledWolf,
  getTemplateRoomInfo,
  PRESET_TEMPLATES,
} from '../Template';
import { RoleName, getActionOrderViaNightPlan } from '../roles';

describe('Template - createTemplateFromRoles', () => {
  it('should create template with correct number of players', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);

    expect(template.numberOfPlayers).toBe(6);
    expect(template.roles).toEqual(roles);
  });

  it('should calculate action order based on roles', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createTemplateFromRoles(roles);

    // Action order should only include roles that are in the template
    expect(template.actionOrder).toContain('wolf');
    expect(template.actionOrder).toContain('seer');
    expect(template.actionOrder).toContain('witch');
    expect(template.actionOrder).not.toContain('villager'); // villager has no night action
  });

  it('should respect NightPlan-derived order sequence', () => {
    const roles: RoleName[] = ['seer', 'wolf', 'witch', 'guard', 'hunter'];
    const template = createTemplateFromRoles(roles);

    // Verify order matches NightPlan-derived order
    const expectedOrder = getActionOrderViaNightPlan(roles);
    expect(template.actionOrder).toEqual(expectedOrder);
  });

  it('should handle templates with special wolves', () => {
    const roles: RoleName[] = ['wolf', 'wolfQueen', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);

    expect(template.actionOrder).toContain('wolf');
    expect(template.actionOrder).toContain('wolfQueen');
    // wolf should come before wolfQueen per NightPlan order
    const wolfIndex = template.actionOrder.indexOf('wolf');
    const wolfQueenIndex = template.actionOrder.indexOf('wolfQueen');
    expect(wolfIndex).toBeLessThan(wolfQueenIndex);
  });

  it('should handle templates with nightmare', () => {
    const roles: RoleName[] = ['wolf', 'nightmare', 'seer', 'witch', 'guard', 'villager'];
    const template = createTemplateFromRoles(roles);

    // nightmare should act before wolf
    const nightmareIndex = template.actionOrder.indexOf('nightmare');
    const wolfIndex = template.actionOrder.indexOf('wolf');
    expect(nightmareIndex).toBeLessThan(wolfIndex);
  });

  it('should handle templates with magician', () => {
    const roles: RoleName[] = ['wolf', 'magician', 'seer', 'witch', 'villager', 'villager'];
    const template = createTemplateFromRoles(roles);

    // magician should act first (swap numbers)
    expect(template.actionOrder[0]).toBe('magician');
  });
});

describe('Template - createCustomTemplate', () => {
  it('should keep roles in original order (shuffling happens at assignRoles)', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    const template = createCustomTemplate([...roles]);
    
    // Roles should be in the same order as input
    expect(template.roles).toEqual(roles);
  });

  it('should preserve all roles', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    const template = createCustomTemplate(roles);

    // Count each role
    const originalCounts = roles.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const templateCounts = template.roles.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(templateCounts).toEqual(originalCounts);
  });

  it('should maintain correct player count', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'villager'];
    const template = createCustomTemplate(roles);

    expect(template.numberOfPlayers).toBe(4);
    expect(template.roles.length).toBe(4);
  });

  it('should calculate correct action order for shuffled template', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'guard'];
    const template = createCustomTemplate(roles);

    // Action order should be based on role presence, not position
    expect(template.actionOrder).toContain('guard');
    expect(template.actionOrder).toContain('wolf');
    expect(template.actionOrder).toContain('witch');
    expect(template.actionOrder).toContain('seer');
  });
});

describe('Template - templateHasSkilledWolf', () => {
  it('should return false for template with only regular wolves', () => {
    const template = createTemplateFromRoles(['wolf', 'wolf', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(false);
  });

  it('should return true for template with wolfQueen', () => {
    const template = createTemplateFromRoles(['wolf', 'wolfQueen', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(true);
  });

  it('should return true for template with darkWolfKing', () => {
    const template = createTemplateFromRoles(['wolf', 'darkWolfKing', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(true);
  });

  it('should return true for template with nightmare', () => {
    const template = createTemplateFromRoles(['wolf', 'nightmare', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(true);
  });

  it('should return true for template with bloodMoon', () => {
    const template = createTemplateFromRoles(['wolf', 'bloodMoon', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(true);
  });

  it('should return false for template with wolfRobot (not considered skilled)', () => {
    const template = createTemplateFromRoles(['wolf', 'wolfRobot', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(false);
  });

  it('should return false for template with gargoyle (not considered skilled)', () => {
    const template = createTemplateFromRoles(['wolf', 'gargoyle', 'seer', 'witch', 'villager']);
    expect(templateHasSkilledWolf(template)).toBe(false);
  });
});

describe('Template - getTemplateRoomInfo', () => {
  it('should generate correct info for standard template', () => {
    const template = createTemplateFromRoles([
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'wolf',
      'seer', 'witch', 'hunter', 'idiot',
    ]);
    
    const info = getTemplateRoomInfo(template);
    
    expect(info).toContain('村民x4');
    expect(info).toContain('普狼x4');
    expect(info).toContain('预言家');
    expect(info).toContain('女巫');
    expect(info).toContain('猎人');
    expect(info).toContain('白痴');
  });

  it('should show special wolves by name', () => {
    const template = createTemplateFromRoles([
      'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolfQueen',
      'seer', 'witch', 'hunter',
    ]);
    
    const info = getTemplateRoomInfo(template);
    
    expect(info).toContain('狼美人');
    expect(info).toContain('普狼x2');
  });

  it('should handle template with no villagers', () => {
    const template = createTemplateFromRoles([
      'wolf', 'wolf',
      'seer', 'witch', 'hunter', 'guard',
    ]);
    
    const info = getTemplateRoomInfo(template);
    
    expect(info).toContain('村民x0');
    expect(info).toContain('普狼x2');
  });
});

describe('Template - PRESET_TEMPLATES', () => {
  it('should have valid 12-player templates', () => {
    PRESET_TEMPLATES.forEach(preset => {
      expect(preset.roles.length).toBe(12);
    });
  });

  it('should have required roles in standard template', () => {
    const standard = PRESET_TEMPLATES.find(t => t.name === '标准板12人');
    expect(standard).toBeDefined();
    expect(standard!.roles.filter(r => r === 'villager').length).toBe(4);
    expect(standard!.roles.filter(r => r === 'wolf').length).toBe(4);
    expect(standard!.roles).toContain('seer');
    expect(standard!.roles).toContain('witch');
    expect(standard!.roles).toContain('hunter');
    expect(standard!.roles).toContain('idiot');
  });

  it('should have valid action order for all presets', () => {
    PRESET_TEMPLATES.forEach(preset => {
      const template = createTemplateFromRoles(preset.roles);
      
      // Action order should only include roles from the template
      template.actionOrder.forEach(role => {
        expect(preset.roles).toContain(role);
      });
    });
  });
});

describe('Template - Action Order Edge Cases', () => {
  it('should handle empty roles array', () => {
    const template = createTemplateFromRoles([]);
    
    expect(template.numberOfPlayers).toBe(0);
    expect(template.roles).toEqual([]);
    expect(template.actionOrder).toEqual([]);
  });

  it('should handle all villagers (no night actions)', () => {
    const template = createTemplateFromRoles(['villager', 'villager', 'villager']);
    
    expect(template.actionOrder).toEqual([]);
  });

  it('should handle duplicate roles in action order', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'wolf', 'seer', 'witch'];
    const template = createTemplateFromRoles(roles);
    
    // wolf should only appear once in action order
    const wolfCount = template.actionOrder.filter(r => r === 'wolf').length;
    expect(wolfCount).toBe(1);
  });

  it('should handle all action roles', () => {
    // Template with many action roles
    const roles: RoleName[] = [
  'slacker', 'wolfRobot', 'magician', 'dreamcatcher',
      'gargoyle', 'nightmare', 'guard', 'wolf',
      'wolfQueen', 'witch', 'seer', 'hunter',
    ];
    const template = createTemplateFromRoles(roles);
    
    // All should be in action order
    expect(template.actionOrder.length).toBe(12);
  });
});

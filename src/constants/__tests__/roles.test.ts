import {
  RoleName,
  ROLES,
  ACTION_ORDER,
  isWolfRole,
  hasNightAction,
  Faction,
  getRoleDisplayName,
  getRoleTeam,
  getRoleTeamDisplayName,
  getTeamDisplayName,
  getNightActionOrderForRoles,
  getWolfRoleIds,
  TEAM_DISPLAY_NAMES,
  ROLE_MODELS,
} from '../roles';

describe('roles - ROLES constant', () => {
  it('should have name matching key for each role', () => {
    Object.entries(ROLES).forEach(([key, role]) => {
      expect(role.name).toBe(key);
    });
  });

  it('should have required properties for each role', () => {
    Object.values(ROLES).forEach(role => {
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('displayName');
      expect(role).toHaveProperty('type');
      expect(role).toHaveProperty('description');
    });
  });

  it('should have valid type assignment', () => {
    const validTypes: Faction[] = [Faction.Wolf, Faction.Villager, Faction.God, Faction.Special];
    Object.values(ROLES).forEach(role => {
      expect(validTypes).toContain(role.type);
    });
  });

  it('should have all core roles defined', () => {
    const coreRoles = ['wolf', 'villager', 'seer', 'witch', 'hunter', 'guard', 'idiot'];
    coreRoles.forEach(role => {
      expect(ROLES).toHaveProperty(role);
    });
  });

  it('should have all special wolf roles defined', () => {
    const wolfRoles = ['wolf', 'wolfQueen', 'darkWolfKing', 'nightmare', 'bloodMoon', 'wolfRobot', 'gargoyle'];
    wolfRoles.forEach(role => {
      expect(ROLES).toHaveProperty(role);
    });
  });
});

describe('roles - isWolfRole', () => {
  it('should return true for regular wolf', () => {
    expect(isWolfRole('wolf')).toBe(true);
  });

  it('should return true for wolfQueen', () => {
    expect(isWolfRole('wolfQueen')).toBe(true);
  });

  it('should return true for darkWolfKing', () => {
    expect(isWolfRole('darkWolfKing')).toBe(true);
  });

  it('should return true for nightmare', () => {
    expect(isWolfRole('nightmare')).toBe(true);
  });

  it('should return true for bloodMoon', () => {
    expect(isWolfRole('bloodMoon')).toBe(true);
  });

  it('should return true for wolfRobot', () => {
    expect(isWolfRole('wolfRobot')).toBe(true);
  });

  it('should return true for gargoyle', () => {
    expect(isWolfRole('gargoyle')).toBe(true);
  });

  it('should return false for villager', () => {
    expect(isWolfRole('villager')).toBe(false);
  });

  it('should return false for seer', () => {
    expect(isWolfRole('seer')).toBe(false);
  });

  it('should return false for witch', () => {
    expect(isWolfRole('witch')).toBe(false);
  });

  it('should return false for hunter', () => {
    expect(isWolfRole('hunter')).toBe(false);
  });

  it('should return false for guard', () => {
    expect(isWolfRole('guard')).toBe(false);
  });

  it('should return false for idiot', () => {
    expect(isWolfRole('idiot')).toBe(false);
  });

  it('should return false for third party roles', () => {
    // Test god roles that are not wolves
    const nonWolfRoles: RoleName[] = ['seer', 'witch', 'hunter', 'guard'];
    nonWolfRoles.forEach(role => {
      expect(isWolfRole(role)).toBe(false);
    });
  });
});

describe('roles - hasNightAction', () => {
  it('should return true for wolf', () => {
    expect(hasNightAction('wolf')).toBe(true);
  });

  it('should return true for seer', () => {
    expect(hasNightAction('seer')).toBe(true);
  });

  it('should return true for witch', () => {
    expect(hasNightAction('witch')).toBe(true);
  });

  it('should return true for guard', () => {
    expect(hasNightAction('guard')).toBe(true);
  });

  it('should return true for hunter', () => {
    expect(hasNightAction('hunter')).toBe(true);
  });

  it('should return false for villager', () => {
    expect(hasNightAction('villager')).toBe(false);
  });

  it('should return false for idiot', () => {
    expect(hasNightAction('idiot')).toBe(false);
  });

  it('should return false for knight', () => {
    expect(hasNightAction('knight')).toBe(false);
  });

  it('should match ACTION_ORDER for roles with night actions', () => {
    // All roles in ACTION_ORDER should have night action
    ACTION_ORDER.forEach(role => {
      expect(hasNightAction(role)).toBe(true);
    });
  });
});

describe('roles - ACTION_ORDER', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(ACTION_ORDER)).toBe(true);
    expect(ACTION_ORDER.length).toBeGreaterThan(0);
  });

  it('should contain valid role names', () => {
    ACTION_ORDER.forEach(role => {
      expect(ROLES).toHaveProperty(role);
    });
  });

  it('should only include roles with night actions', () => {
    ACTION_ORDER.forEach(role => {
      expect(hasNightAction(role)).toBe(true);
    });
  });

  it('should have slacker first if included', () => {
    // NOTE: ACTION_ORDER is derived from role models sorted by actionOrder.
    // Magician is configured as the earliest role (actionOrder: -2), so it can
    // preempt slacker (actionOrder: -1).
    if (ACTION_ORDER.includes('slacker')) {
      const slackerIndex = ACTION_ORDER.indexOf('slacker');
      expect(slackerIndex).toBeGreaterThanOrEqual(0);

      const magicianIndex = ACTION_ORDER.indexOf('magician');
      if (magicianIndex !== -1) {
        expect(magicianIndex).toBeLessThan(slackerIndex);
      }
    }
  });

  it('should have nightmare before wolf', () => {
    const nightmareIndex = ACTION_ORDER.indexOf('nightmare');
    const wolfIndex = ACTION_ORDER.indexOf('wolf');
    
    if (nightmareIndex !== -1 && wolfIndex !== -1) {
      expect(nightmareIndex).toBeLessThan(wolfIndex);
    }
  });

  it('should have guard before wolf', () => {
    const guardIndex = ACTION_ORDER.indexOf('guard');
    const wolfIndex = ACTION_ORDER.indexOf('wolf');
    
    if (guardIndex !== -1 && wolfIndex !== -1) {
      expect(guardIndex).toBeLessThan(wolfIndex);
    }
  });

  it('should have wolf before seer', () => {
    const wolfIndex = ACTION_ORDER.indexOf('wolf');
    const seerIndex = ACTION_ORDER.indexOf('seer');
    
    if (wolfIndex !== -1 && seerIndex !== -1) {
      expect(wolfIndex).toBeLessThan(seerIndex);
    }
  });

  it('should have witch before seer', () => {
    const seerIndex = ACTION_ORDER.indexOf('seer');
    const witchIndex = ACTION_ORDER.indexOf('witch');
    
    // In this game, witch acts before seer (sees kill result first)
    if (seerIndex !== -1 && witchIndex !== -1) {
      expect(witchIndex).toBeLessThan(seerIndex);
    }
  });

  it('should not have duplicate roles', () => {
    const uniqueRoles = new Set(ACTION_ORDER);
    expect(uniqueRoles.size).toBe(ACTION_ORDER.length);
  });
});

describe('roles - Type classification', () => {
  it('should have villager in villager type', () => {
    expect(ROLES.villager.type).toBe('villager');
  });

  it('should have all wolves in wolf type', () => {
    const wolfRoleNames: RoleName[] = ['wolf', 'wolfQueen', 'darkWolfKing', 'nightmare', 'bloodMoon', 'wolfRobot', 'gargoyle'];
    wolfRoleNames.forEach(name => {
      expect(ROLES[name].type).toBe('wolf');
    });
  });

  it('should have god roles in god type', () => {
    const godRoles: RoleName[] = ['seer', 'witch', 'hunter', 'guard', 'idiot', 'knight'];
    godRoles.forEach(name => {
      expect(ROLES[name].type).toBe('god');
    });
  });
});

describe('roles - Display names', () => {
  it('should have displayName for villager', () => {
    expect(ROLES.villager.displayName).toBe('普通村民');
  });

  it('should have displayName for wolf', () => {
    expect(ROLES.wolf.displayName).toBe('狼人');
  });

  it('should have displayName for seer', () => {
    expect(ROLES.seer.displayName).toBe('预言家');
  });

  it('should have displayName for witch', () => {
    expect(ROLES.witch.displayName).toBe('女巫');
  });

  it('should have displayName for hunter', () => {
    expect(ROLES.hunter.displayName).toBe('猎人');
  });

  it('should have non-empty displayName for all roles', () => {
    Object.values(ROLES).forEach(role => {
      expect(role.displayName).toBeTruthy();
      expect(role.displayName.length).toBeGreaterThan(0);
    });
  });
});

describe('roles - Role descriptions', () => {
  it('should have non-empty descriptions for all roles', () => {
    Object.values(ROLES).forEach(role => {
      expect(role.description).toBeTruthy();
      expect(role.description.length).toBeGreaterThan(0);
    });
  });

  it('should have meaningful seer description', () => {
    expect(ROLES.seer.description).toContain('查验');
  });

  it('should have meaningful witch description', () => {
    expect(ROLES.witch.description).toMatch(/解药|毒药/);
  });

  it('should have meaningful hunter description', () => {
    expect(ROLES.hunter.description).toMatch(/带|枪|开枪/);
  });
});

// ============================================================
// Role Registry Contract Tests - Single Source of Truth
// ============================================================

describe('Role Registry - Single Source of Truth', () => {
  const allRoleNames: RoleName[] = Object.keys(ROLE_MODELS) as RoleName[];

  describe('Exhaustiveness - Every RoleName has a definition', () => {
    it('should have ROLE_MODELS entry for every role', () => {
      allRoleNames.forEach(roleName => {
        expect(ROLE_MODELS[roleName]).toBeDefined();
        expect(ROLE_MODELS[roleName].id).toBe(roleName);
      });
    });

    it('should have ROLES entry for every role', () => {
      allRoleNames.forEach(roleName => {
        expect(ROLES[roleName]).toBeDefined();
        expect(ROLES[roleName].name).toBe(roleName);
      });
    });
  });

  describe('getRoleDisplayName - returns non-empty for all roles', () => {
    it('should return non-empty string for every role', () => {
      allRoleNames.forEach(roleName => {
        const displayName = getRoleDisplayName(roleName);
        expect(displayName).toBeTruthy();
        expect(displayName.length).toBeGreaterThan(0);
      });
    });

    it('should match ROLES displayName', () => {
      allRoleNames.forEach(roleName => {
        expect(getRoleDisplayName(roleName)).toBe(ROLES[roleName].displayName);
      });
    });
  });

  describe('Team classification - Consistent wolf/good/third', () => {
    it('should return wolf team for all wolf faction roles', () => {
      allRoleNames.filter(r => isWolfRole(r)).forEach(roleName => {
        expect(getRoleTeam(roleName)).toBe('wolf');
      });
    });

    it('should return good team for non-wolf non-special roles', () => {
      const goodRoles: RoleName[] = ['seer', 'witch', 'hunter', 'guard', 'villager'];
      goodRoles.forEach(roleName => {
        expect(getRoleTeam(roleName)).toBe('good');
      });
    });

    it('should have consistent team display names', () => {
      expect(TEAM_DISPLAY_NAMES.wolf).toBe('狼人');
      expect(TEAM_DISPLAY_NAMES.good).toBe('好人');
      expect(TEAM_DISPLAY_NAMES.third).toBe('第三方');
    });

    it('getTeamDisplayName should return correct Chinese names', () => {
      expect(getTeamDisplayName('wolf')).toBe('狼人');
      expect(getTeamDisplayName('good')).toBe('好人');
      expect(getTeamDisplayName('third')).toBe('第三方');
    });

    it('getRoleTeamDisplayName should return 狼人 for wolf roles', () => {
      expect(getRoleTeamDisplayName('wolf')).toBe('狼人');
      expect(getRoleTeamDisplayName('wolfQueen')).toBe('狼人');
      expect(getRoleTeamDisplayName('darkWolfKing')).toBe('狼人');
    });

    it('getRoleTeamDisplayName should return 好人 for good roles', () => {
      expect(getRoleTeamDisplayName('seer')).toBe('好人');
      expect(getRoleTeamDisplayName('witch')).toBe('好人');
      expect(getRoleTeamDisplayName('villager')).toBe('好人');
    });
  });

  describe('getWolfRoleIds - returns all wolf roles', () => {
    it('should return array of wolf role IDs', () => {
      const wolfIds = getWolfRoleIds();
      expect(Array.isArray(wolfIds)).toBe(true);
      expect(wolfIds.length).toBeGreaterThan(0);
    });

    it('should include all known wolf roles', () => {
      const wolfIds = getWolfRoleIds();
      expect(wolfIds).toContain('wolf');
      expect(wolfIds).toContain('wolfQueen');
      expect(wolfIds).toContain('darkWolfKing');
    });

    it('should not include non-wolf roles', () => {
      const wolfIds = getWolfRoleIds();
      expect(wolfIds).not.toContain('seer');
      expect(wolfIds).not.toContain('villager');
      expect(wolfIds).not.toContain('witch');
    });

    it('every returned ID should pass isWolfRole', () => {
      getWolfRoleIds().forEach(id => {
        expect(isWolfRole(id)).toBe(true);
      });
    });
  });

  describe('getNightActionOrderForRoles - stable order, no duplicates', () => {
    it('should return subset of input roles that have night actions', () => {
      const input: RoleName[] = ['wolf', 'seer', 'witch', 'villager', 'guard'];
      const result = getNightActionOrderForRoles(input);
      
      // All results should be in input
      result.forEach(r => expect(input).toContain(r));
      
      // All results should have night action
      result.forEach(r => expect(hasNightAction(r)).toBe(true));
      
      // villager should not be in result (no night action)
      expect(result).not.toContain('villager');
    });

    it('should have no duplicates', () => {
      const input: RoleName[] = ['wolf', 'seer', 'witch', 'guard', 'hunter'];
      const result = getNightActionOrderForRoles(input);
      const unique = new Set(result);
      expect(result.length).toBe(unique.size);
    });

    it('should be stable (same input → same output)', () => {
      const input: RoleName[] = ['witch', 'wolf', 'seer', 'guard'];
      const result1 = getNightActionOrderForRoles(input);
      const result2 = getNightActionOrderForRoles(input);
      expect(result1).toEqual(result2);
    });

    it('should respect action order (wolf before seer in standard order)', () => {
      const input: RoleName[] = ['seer', 'wolf', 'witch'];
      const result = getNightActionOrderForRoles(input);
      const wolfIndex = result.indexOf('wolf');
      const seerIndex = result.indexOf('seer');
      // Wolf should act before seer
      expect(wolfIndex).toBeLessThan(seerIndex);
    });
  });
});

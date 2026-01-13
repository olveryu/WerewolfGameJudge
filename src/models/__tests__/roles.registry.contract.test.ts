import {
  ACTION_ORDER,
  Faction,
  ROLE_MODELS,
  ROLES,
  SeerCheckResult,
  TEAM_DISPLAY_NAMES,
  Team,
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  getActionOrderViaNightPlan,
  getNightActionOrderForRoles,
  getRoleDisplayName,
  getRoleEnglishName,
  getRoleTeam,
  getRoleTeamDisplayName,
  getSeerCheckResult,
  getTeamDisplayName,
  getWolfRoleIds,
  hasNightAction,
  isWolfRole,
  type RoleName,
} from '../roles';

describe('Role Registry - ROLES constant', () => {
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
    const coreRoles: RoleName[] = ['wolf', 'villager', 'seer', 'witch', 'hunter', 'guard', 'idiot'];
    coreRoles.forEach(role => {
      expect(ROLES).toHaveProperty(role);
    });
  });

  it('should have all special wolf roles defined', () => {
    const wolfRoles: RoleName[] = ['wolf', 'wolfQueen', 'darkWolfKing', 'nightmare', 'bloodMoon', 'wolfRobot', 'gargoyle'];
    wolfRoles.forEach(role => {
      expect(ROLES).toHaveProperty(role);
    });
  });
});

describe('Role Registry - isWolfRole', () => {
  it('should return true for wolf-faction roles', () => {
    const wolves: RoleName[] = ['wolf', 'wolfQueen', 'wolfKing', 'darkWolfKing', 'nightmare', 'gargoyle', 'bloodMoon', 'wolfRobot', 'spiritKnight'];
    wolves.forEach(role => {
      expect(isWolfRole(role)).toBe(true);
    });
  });

  it('should return false for non-wolf roles', () => {
    const nonWolves: RoleName[] = ['villager', 'seer', 'witch', 'hunter', 'guard', 'idiot', 'graveyardKeeper', 'slacker', 'knight', 'dreamcatcher', 'magician', 'witcher', 'psychic'];
    nonWolves.forEach(role => {
      expect(isWolfRole(role)).toBe(false);
    });
  });
});

describe('Role Registry - hasNightAction', () => {
  it('should return false for villager', () => {
    expect(hasNightAction('villager')).toBe(false);
  });

  it('should match ACTION_ORDER for roles with night actions', () => {
    ACTION_ORDER.forEach(role => {
      expect(hasNightAction(role)).toBe(true);
    });
  });
});

describe('Role Registry - ACTION_ORDER', () => {
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

  it('should not have duplicate roles', () => {
    const uniqueRoles = new Set(ACTION_ORDER);
    expect(uniqueRoles.size).toBe(ACTION_ORDER.length);
  });
});

describe('Role Registry - Type classification', () => {
  it('should have villager as Villager faction', () => {
    expect(ROLES.villager.type).toBe(Faction.Villager);
  });

  it('should have wolves as Wolf faction', () => {
    const wolfRoleNames: RoleName[] = ['wolf', 'wolfQueen', 'wolfKing', 'darkWolfKing', 'nightmare', 'bloodMoon', 'wolfRobot', 'gargoyle', 'spiritKnight'];
    wolfRoleNames.forEach(name => {
      expect(ROLES[name].type).toBe(Faction.Wolf);
    });
  });

  it('should have god roles as God faction', () => {
  const godRoles: RoleName[] = ['seer', 'witch', 'hunter', 'guard', 'idiot', 'knight', 'magician', 'witcher', 'psychic', 'graveyardKeeper', 'dreamcatcher'];
    godRoles.forEach(name => {
      expect(ROLES[name].type).toBe(Faction.God);
    });
  });

  it('should have slacker as Special faction', () => {
    expect(ROLES.slacker.type).toBe(Faction.Special);
  });
});

describe('Role Registry - Display names and descriptions', () => {
  it('should have non-empty displayName and description for all roles', () => {
    (Object.keys(ROLE_MODELS) as RoleName[]).forEach(roleId => {
      const def = ROLES[roleId];
      expect(def.displayName).toBeTruthy();
      expect(def.description).toBeTruthy();
    });
  });

  it('getRoleDisplayName should match ROLES displayName', () => {
    (Object.keys(ROLE_MODELS) as RoleName[]).forEach(roleId => {
      expect(getRoleDisplayName(roleId)).toBe(ROLES[roleId].displayName);
    });
  });

  it('getRoleEnglishName should return Dreamcatcher for dreamcatcher role id', () => {
    expect(getRoleEnglishName('dreamcatcher')).toBe('Dreamcatcher');
  });

});

describe('Role Registry - Team classification', () => {
  it('TEAM_DISPLAY_NAMES should be exhaustive', () => {
    const keys = Object.keys(TEAM_DISPLAY_NAMES) as Team[];
    expect(keys.sort()).toEqual(['good', 'third', 'wolf']);
  });

  it('getTeamDisplayName should return correct Chinese names', () => {
    expect(getTeamDisplayName('wolf')).toBe('狼人');
    expect(getTeamDisplayName('good')).toBe('好人');
    expect(getTeamDisplayName('third')).toBe('第三方');
  });

  it('getRoleTeamDisplayName should be consistent with getRoleTeam', () => {
    (Object.keys(ROLE_MODELS) as RoleName[]).forEach(roleId => {
      expect(getRoleTeamDisplayName(roleId)).toBe(TEAM_DISPLAY_NAMES[getRoleTeam(roleId)]);
    });
  });
});

describe('Role Registry - getWolfRoleIds', () => {
  it('should return all wolf role IDs and only wolf role IDs', () => {
    const ids = getWolfRoleIds();
    expect(ids.length).toBeGreaterThan(0);

    ids.forEach(id => {
      expect(isWolfRole(id)).toBe(true);
    });

    // sanity: should not include villager
    expect(ids).not.toContain('villager');
  });
});

describe('Role Registry - Wolf meeting/vote invariants', () => {
  it('non-voting wolves must not see wolves (non-meeting)', () => {
    const wolves = getWolfRoleIds();
    wolves.forEach(roleId => {
      const votes = doesRoleParticipateInWolfVote(roleId);
      const sees = canRoleSeeWolves(roleId);
      if (votes) {
        expect(sees).toBe(true);
      }
    });
  });
});

describe('Role Registry - getNightActionOrderForRoles', () => {
  it('should return subset of input roles that have night actions', () => {
    const roles: RoleName[] = ['villager', 'wolf', 'seer', 'idiot', 'witch'];
    const ordered = getNightActionOrderForRoles(roles);

    // villager/idiot have no night action, should be filtered
    expect(ordered).not.toContain('villager');
    expect(ordered).not.toContain('idiot');

    // wolf/seer/witch should remain
    expect(ordered).toEqual(expect.arrayContaining(['wolf', 'seer', 'witch']));
  });

  it('should have no duplicates', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'seer', 'seer', 'witch'];
    const ordered = getNightActionOrderForRoles(roles);
    expect(new Set(ordered).size).toBe(ordered.length);
  });

  it('should be stable (same input → same output)', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'witch', 'guard'];
    expect(getNightActionOrderForRoles(roles)).toEqual(getNightActionOrderForRoles(roles));
  });
});

describe('Role Registry - getSeerCheckResult (Seer Binary Result)', () => {
  it("should return only '好人' or '狼人'", () => {
    const allRoles = Object.keys(ROLE_MODELS) as RoleName[];
    const validResults: SeerCheckResult[] = ['好人', '狼人'];

    allRoles.forEach(role => {
      expect(validResults).toContain(getSeerCheckResult(role));
    });
  });

  it("should return '狼人' for all wolf-faction roles", () => {
    const wolfRoles: RoleName[] = ['wolf', 'wolfQueen', 'wolfKing', 'darkWolfKing', 'nightmare', 'gargoyle', 'bloodMoon', 'wolfRobot', 'spiritKnight'];
    wolfRoles.forEach(role => {
      expect(getSeerCheckResult(role)).toBe('狼人');
    });
  });

  it("should return '好人' for slacker (third-party)", () => {
    expect(getSeerCheckResult('slacker')).toBe('好人');
  });
});

// =============================================================================
// NightPlan compat tests - ensure new path matches legacy
// =============================================================================
describe('NightPlan compat with legacy getNightActionOrderForRoles', () => {
  it('should match getNightActionOrderForRoles for basic roles', () => {
    const testCases: RoleName[][] = [
      ['wolf', 'seer', 'witch', 'villager'],
      ['wolf', 'guard', 'seer', 'hunter'],
      ['wolf', 'witch', 'seer', 'villager', 'villager'],
    ];
    testCases.forEach(roles => {
      const legacy = getNightActionOrderForRoles(roles);
      const newPath = getActionOrderViaNightPlan(roles);
      expect(newPath).toEqual(legacy);
    });
  });

  it('should match for skilled wolves (gargoyle, nightmare, wolfRobot)', () => {
    const roles: RoleName[] = ['gargoyle', 'wolf', 'witch', 'seer', 'hunter', 'villager'];
    expect(getActionOrderViaNightPlan(roles)).toEqual(getNightActionOrderForRoles(roles));

    const roles2: RoleName[] = ['nightmare', 'guard', 'wolf', 'witch', 'seer', 'hunter'];
    expect(getActionOrderViaNightPlan(roles2)).toEqual(getNightActionOrderForRoles(roles2));

    const roles3: RoleName[] = ['wolfRobot', 'guard', 'wolf', 'witch', 'psychic', 'hunter'];
    expect(getActionOrderViaNightPlan(roles3)).toEqual(getNightActionOrderForRoles(roles3));
  });

  it('should match for god roles (magician, dreamcatcher, psychic)', () => {
    const roles: RoleName[] = ['magician', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing'];
    expect(getActionOrderViaNightPlan(roles)).toEqual(getNightActionOrderForRoles(roles));

    const roles2: RoleName[] = ['dreamcatcher', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing'];
    expect(getActionOrderViaNightPlan(roles2)).toEqual(getNightActionOrderForRoles(roles2));

    const roles3: RoleName[] = ['wolf', 'witch', 'psychic', 'hunter', 'villager'];
    expect(getActionOrderViaNightPlan(roles3)).toEqual(getNightActionOrderForRoles(roles3));
  });

  it('should match for slacker (third-party)', () => {
    const roles: RoleName[] = ['slacker', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    expect(getActionOrderViaNightPlan(roles)).toEqual(getNightActionOrderForRoles(roles));
  });

  it('should exclude roles without night-1 action (witcher, bloodMoon, wolfKing)', () => {
    const roles: RoleName[] = ['witcher', 'bloodMoon', 'wolfKing', 'wolf', 'seer', 'witch'];
    const result = getActionOrderViaNightPlan(roles);
    expect(result).not.toContain('witcher');
    expect(result).not.toContain('bloodMoon');
    expect(result).not.toContain('wolfKing');
    expect(result).toEqual(getNightActionOrderForRoles(roles));
  });

  it('should deduplicate multiple wolves', () => {
    const roles: RoleName[] = ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'villager'];
    const result = getActionOrderViaNightPlan(roles);
    expect(result.filter(r => r === 'wolf').length).toBe(1);
    expect(result).toEqual(getNightActionOrderForRoles(roles));
  });
});

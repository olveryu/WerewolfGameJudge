/**
 * Action Flow Tests
 * 
 * Tests to verify the action order and dialog flow work correctly
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  getKilledIndex,
  proceedToNextAction,
} from '../Room';
import { createTemplateFromRoles } from '../Template';
import { RoleName, ROLES } from '../roles';
import { PlayerStatus, SkillStatus } from '../Player';

// Helper to create a room with all seats filled
const createTestRoom = (roles: RoleName[]): Room => {
  const template = createTemplateFromRoles(roles);
  const room = createRoom('test-host', 'TEST001', template);
  
  // Fill all seats
  roles.forEach((role, seat) => {
    room.players.set(seat, {
      uid: `player_${seat}`,
      seatNumber: seat,
      role,
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,
      displayName: `Player ${seat + 1}`,
    });
  });
  
  // Start the game
  room.roomStatus = RoomStatus.assigned;
  room.currentActionerIndex = 0;
  
  return room;
};

describe('Action Order - 标准板12人', () => {
  const standardRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'wolf',
    'seer', 'witch', 'hunter', 'idiot',
  ];

  it('should have correct action order for 标准板', () => {
    const template = createTemplateFromRoles(standardRoles);
    
    // 标准板 has: wolf, witch, seer, hunter
    // According to ACTION_ORDER: wolf (index 7), witch (index 9), seer (index 10), hunter (index 12)
    expect(template.actionOrder).toEqual(['wolf', 'witch', 'seer', 'hunter']);
  });

  it('should progress through actions in correct order', () => {
    let room = createTestRoom(standardRoles);
    
    // Step 0: Wolf turn
    expect(room.currentActionerIndex).toBe(0);
    expect(getCurrentActionRole(room)).toBe('wolf');
    
    // Wolf kills player 0
    room = proceedToNextAction(room, 0);
    
    // Step 1: Witch turn
    expect(room.currentActionerIndex).toBe(1);
    expect(getCurrentActionRole(room)).toBe('witch');
    expect(getKilledIndex(room)).toBe(0); // Witch should see player 0 was killed
    
    // Witch doesn't save or poison
    room = proceedToNextAction(room, null);
    
    // Step 2: Seer turn  
    expect(room.currentActionerIndex).toBe(2);
    expect(getCurrentActionRole(room)).toBe('seer');
    
    // Seer checks player 4 (wolf)
    room = proceedToNextAction(room, 4);
    
    // Step 3: Hunter turn
    expect(room.currentActionerIndex).toBe(3);
    expect(getCurrentActionRole(room)).toBe('hunter');
    
    // Hunter confirms status
    room = proceedToNextAction(room, null);
    
    // Night ended
    expect(room.currentActionerIndex).toBe(4);
    expect(getCurrentActionRole(room)).toBe(null);
  });

  it('witch should see correct killed player from wolf action', () => {
    let room = createTestRoom(standardRoles);
    
    // Wolf kills player 5
    room = proceedToNextAction(room, 5);
    
    // Now it's witch turn
    expect(getCurrentActionRole(room)).toBe('witch');
    
    // Witch should see player 5 was killed
    expect(getKilledIndex(room)).toBe(5);
  });
});

describe('Action Order - 狼美守卫12人', () => {
  const wolfQueenRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'wolfQueen',
    'seer', 'witch', 'hunter', 'guard',
  ];

  it('should have correct action order with guard and wolfQueen', () => {
    const template = createTemplateFromRoles(wolfQueenRoles);
    
    // Should be: guard, wolf, wolfQueen, witch, seer, hunter
    expect(template.actionOrder).toEqual(['guard', 'wolf', 'wolfQueen', 'witch', 'seer', 'hunter']);
  });

  it('should progress guard -> wolf -> wolfQueen -> witch', () => {
    let room = createTestRoom(wolfQueenRoles);
    
    // Step 0: Guard
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 0); // Guard protects player 0
    
    // Step 1: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 1); // Wolf kills player 1
    
    // Step 2: Wolf Queen
    expect(getCurrentActionRole(room)).toBe('wolfQueen');
    room = proceedToNextAction(room, 2); // Wolf Queen links player 2
    
    // Step 3: Witch
    expect(getCurrentActionRole(room)).toBe('witch');
    expect(getKilledIndex(room)).toBe(1); // Witch should see player 1 was killed
  });
});

describe('Action Order - 黑狼王守卫12人', () => {
  const darkWolfKingRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'darkWolfKing',
    'seer', 'witch', 'hunter', 'guard',
  ];

  it('should have correct action order with darkWolfKing', () => {
    const template = createTemplateFromRoles(darkWolfKingRoles);
    
    // Should be: guard, wolf, witch, seer, hunter, darkWolfKing
    expect(template.actionOrder).toEqual(['guard', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

  it('should progress through all actions correctly', () => {
    let room = createTestRoom(darkWolfKingRoles);
    
    // Step 0: Guard
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 0);
    
    // Step 1: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 1);
    
    // Step 2: Witch
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null);
    
    // Step 3: Seer
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 4);
    
    // Step 4: Hunter
    expect(getCurrentActionRole(room)).toBe('hunter');
    room = proceedToNextAction(room, null);
    
    // Step 5: Dark Wolf King
    expect(getCurrentActionRole(room)).toBe('darkWolfKing');
    room = proceedToNextAction(room, null);
    
    // Night ended
    expect(getCurrentActionRole(room)).toBe(null);
  });
});

describe('Action Order - 石像鬼守墓人12人', () => {
  const gargoyleRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'gargoyle',
    'seer', 'witch', 'hunter', 'graveyardKeeper',
  ];

  it('should have correct action order with gargoyle', () => {
    const template = createTemplateFromRoles(gargoyleRoles);
    
    // Gargoyle is in ACTION_ORDER at index 4, before wolf
  // GraveyardKeeper is configured with hasNightAction=true, so it's included.
  expect(template.actionOrder).toEqual(['gargoyle', 'wolf', 'witch', 'seer', 'hunter', 'graveyardKeeper']);
  });

  it('should have gargoyle act before wolf', () => {
    let room = createTestRoom(gargoyleRoles);
    
    // Step 0: Gargoyle
    expect(getCurrentActionRole(room)).toBe('gargoyle');
    room = proceedToNextAction(room, 8); // Gargoyle checks player 8 (seer) if it's a god
    
    // Step 1: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe('Action Order - 梦魇守卫12人', () => {
  const nightmareRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'nightmare',
    'seer', 'witch', 'hunter', 'guard',
  ];

  it('should have correct action order with nightmare and guard', () => {
    const template = createTemplateFromRoles(nightmareRoles);
    
    // Nightmare is at index 5, guard at index 6, wolf at index 7
    // Should be: nightmare, guard, wolf, witch, seer, hunter
    expect(template.actionOrder).toEqual(['nightmare', 'guard', 'wolf', 'witch', 'seer', 'hunter']);
  });

  it('should have nightmare act first, then guard, then wolf', () => {
    let room = createTestRoom(nightmareRoles);
    
    // Step 0: Nightmare
    expect(getCurrentActionRole(room)).toBe('nightmare');
    room = proceedToNextAction(room, 8); // Nightmare blocks seer
    
    // Step 1: Guard
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 9); // Guard protects witch
    
    // Step 2: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe('Action Order - 血月猎魔12人', () => {
  const bloodMoonRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'bloodMoon',
    'seer', 'witch', 'idiot', 'witcher',
  ];

  it('should have correct action order (bloodMoon has no night action)', () => {
    const template = createTemplateFromRoles(bloodMoonRoles);
    
    // bloodMoon has no night action (actionOrder: -1)
    // Should be: wolf, witch, seer
  // Witcher can only act starting from the second night, so it must be excluded.
  expect(template.actionOrder).toEqual(['wolf', 'witch', 'seer']);
  });

  it('should not include bloodMoon in action order', () => {
    const template = createTemplateFromRoles(bloodMoonRoles);
    expect(template.actionOrder).not.toContain('bloodMoon');
  });
});

describe('Action Order - 狼王摄梦人12人', () => {
  const dreamcatcherRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'darkWolfKing',
  'seer', 'witch', 'hunter', 'dreamcatcher',
  ];

    it('should have correct action order with dreamcatcher', () => {
    const template = createTemplateFromRoles(dreamcatcherRoles);
    
      // dreamcatcher (摄梦人) is at index 3 in ACTION_ORDER
      // Should be: dreamcatcher, wolf, witch, seer, hunter, darkWolfKing
  expect(template.actionOrder).toEqual(['dreamcatcher', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

    it('should have dreamcatcher act first', () => {
    let room = createTestRoom(dreamcatcherRoles);
    
      // Step 0: Dreamcatcher
      expect(getCurrentActionRole(room)).toBe('dreamcatcher');
    room = proceedToNextAction(room, 0); // Celebrity puts player 0 into dream
    
    // Step 1: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe('Action Order - 狼王魔术师12人', () => {
  const magicianRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'darkWolfKing',
    'seer', 'witch', 'hunter', 'magician',
  ];

  it('should have correct action order with magician', () => {
    const template = createTemplateFromRoles(magicianRoles);
    
    // magician is at index 2 in ACTION_ORDER
    // Should be: magician, wolf, witch, seer, hunter, darkWolfKing
    expect(template.actionOrder).toEqual(['magician', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

  it('should have magician act first', () => {
    let room = createTestRoom(magicianRoles);
    
    // Step 0: Magician
    expect(getCurrentActionRole(room)).toBe('magician');
    room = proceedToNextAction(room, null); // Magician chooses not to swap
    
    // Step 1: Wolf
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe('Action Order - 机械狼通灵师12人', () => {
  const wolfRobotRoles: RoleName[] = [
    'villager', 'villager', 'villager', 'villager',
    'wolf', 'wolf', 'wolf', 'wolfRobot',
    'psychic', 'witch', 'hunter', 'guard',
  ];

  it('should have correct action order with wolfRobot and psychic', () => {
    const template = createTemplateFromRoles(wolfRobotRoles);
    
    // wolfRobot is at index 1, psychic is at index 11 in ACTION_ORDER
    // Should be: wolfRobot, guard, wolf, witch, psychic, hunter
    expect(template.actionOrder).toEqual(['wolfRobot', 'guard', 'wolf', 'witch', 'psychic', 'hunter']);
  });

  it('should have wolfRobot act first (learns a player skill)', () => {
    let room = createTestRoom(wolfRobotRoles);
    
    // Step 0: WolfRobot
    expect(getCurrentActionRole(room)).toBe('wolfRobot');
    room = proceedToNextAction(room, 8); // WolfRobot learns from psychic
    
    // Step 1: Guard
    expect(getCurrentActionRole(room)).toBe('guard');
  });

  it('wolfRobot action message should be 请选择学习对象', () => {
    expect(ROLES.wolfRobot.actionMessage).toBe('请选择学习对象');
    expect(ROLES.wolfRobot.actionConfirmMessage).toBe('学习');
  });
});

describe('Role dialog messages', () => {
  it('wolf action message should be 请选择猎杀对象', () => {
    expect(ROLES.wolf.actionMessage).toBe('请选择猎杀对象');
  });

  it('witch has actionMessage but uses custom dialog in UI', () => {
    // Witch has an actionMessage defined, but the UI overrides it
    // with a custom dialog showing the killed player
    expect(ROLES.witch.actionMessage).toBe('请选择使用毒药或解药');
  });

  it('seer action message should be 请选择查验对象', () => {
    expect(ROLES.seer.actionMessage).toBe('请选择查验对象');
  });

  it('hunter has actionMessage but uses custom dialog for skill status', () => {
    // Hunter's actionMessage is defined but UI shows skill status dialog
    expect(ROLES.hunter.actionMessage).toBe('请确认你的发动状态');
  });
});

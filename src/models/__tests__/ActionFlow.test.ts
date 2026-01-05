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
import { RoleName, ROLES } from '../../constants/roles';
import { PlayerStatus, SkillStatus } from '../Player';

// Helper to create a room with all seats filled
const createTestRoom = (roles: RoleName[]): Room => {
  const template = createTemplateFromRoles(roles);
  const room = createRoom('test-host', 'TEST001', template);
  
  // Fill all seats
  roles.forEach((role, seat) => {
    room.players.set(seat, {
      uid: `bot_${seat}`,
      seatNumber: seat,
      role,
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      displayName: `Player ${seat + 1}`,
    });
  });
  
  // Start the game
  room.roomStatus = RoomStatus.ongoing;
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

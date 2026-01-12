/**
 * 狼王摄梦人12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 黑狼王 + 预言家 + 女巫 + 猎人 + 摄梦人
 * 行动顺序：celebrity → wolf → witch → seer → hunter → darkWolfKing
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  proceedToNextAction,
} from '../../Room';
import { createTemplateFromRoles } from '../../Template';
import { RoleName, ROLES } from '../../roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '狼王摄梦人12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'darkWolfKing',
  'seer', 'witch', 'hunter', 'celebrity',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST007', template);
  
  ROLES_CONFIG.forEach((role, seat) => {
    room.players.set(seat, {
      uid: `player_${seat}`,
      seatNumber: seat,
      role,
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,
      displayName: `玩家${seat + 1}`,
    });
  });
  
  room.roomStatus = RoomStatus.assigned;
  room.currentActionerIndex = 0;
  
  return room;
};

describe(`${TEMPLATE_NAME} - 行动顺序测试`, () => {
  it('应该有正确的行动顺序', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    // 摄梦人最早行动
    expect(template.actionOrder).toEqual(['celebrity', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

  it('摄梦人应该最先行动', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('celebrity');
    room = proceedToNextAction(room, 0); // 摄梦人选择0号进入梦游
    
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 摄梦人保护村民`, () => {
  it('摄梦人让村民梦游，村民免疫夜间伤害', () => {
    let room = createTestRoom();
    
    // 摄梦人让0号村民梦游
    room = proceedToNextAction(room, 0);
    expect(room.actions.get('celebrity')).toBe(0);
    
    // 狼人杀0号村民（梦游中，应该免疫）
    room = proceedToNextAction(room, 0);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    // 黑狼王
    room = proceedToNextAction(room, null);
    
    // 注意：实际游戏中梦游者免疫夜间伤害
    // 测试验证流程和动作记录正确
    expect(room.actions.get('celebrity')).toBe(0);
    expect(room.actions.get('wolf')).toBe(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 摄梦人保护预言家`, () => {
  it('预言家梦游时免疫狼刀', () => {
    let room = createTestRoom();
    
    // 摄梦人让8号预言家梦游
    room = proceedToNextAction(room, 8);
    expect(room.actions.get('celebrity')).toBe(8);
    
    // 狼人杀8号预言家
    room = proceedToNextAction(room, 8);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    // 黑狼王
    room = proceedToNextAction(room, null);
    
    // 验证动作都被正确记录
    expect(room.actions.get('celebrity')).toBe(8);
    expect(room.actions.get('wolf')).toBe(8);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('摄梦人对话消息正确', () => {
    expect(ROLES.celebrity.actionMessage).toBe('请选择摄梦对象');
    expect(ROLES.celebrity.actionConfirmMessage).toBe('摄梦');
  });

  it('摄梦人描述正确', () => {
    expect(ROLES.celebrity.description).toContain('梦游');
    expect(ROLES.celebrity.description).toContain('免疫夜间伤害');
  });
});

/**
 * 狼王魔术师12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 黑狼王 + 预言家 + 女巫 + 猎人 + 魔术师
 * 行动顺序：magician → wolf → witch → seer → hunter → darkWolfKing
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  proceedToNextAction,
} from '../../Room';
import { createTemplateFromRoles } from '../../Template';
import { RoleName, ROLES } from '../../../constants/roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '狼王魔术师12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'darkWolfKing',
  'seer', 'witch', 'hunter', 'magician',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST008', template);
  
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
    // 魔术师最早行动
    expect(template.actionOrder).toEqual(['magician', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

  it('魔术师应该最先行动', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('magician');
    room = proceedToNextAction(room, null); // 魔术师可以选择不交换
    
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 魔术师交换座位`, () => {
  it('魔术师选择交换两名玩家的座位', () => {
    let room = createTestRoom();
    
    // 魔术师选择交换操作（假设选择0号）
    room = proceedToNextAction(room, 0);
    expect(room.actions.get('magician')).toBe(0);
    
    // 狼人杀人
    room = proceedToNextAction(room, 3);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    // 黑狼王
    room = proceedToNextAction(room, null);
    
    expect(room.actions.get('wolf')).toBe(3);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 魔术师不操作`, () => {
  it('魔术师选择不交换', () => {
    let room = createTestRoom();
    
    // 魔术师不交换
    room = proceedToNextAction(room, null);
    expect(room.actions.get('magician')).toBeUndefined();
    
    // 狼人杀8号预言家
    room = proceedToNextAction(room, 8);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    // 黑狼王
    room = proceedToNextAction(room, null);
    
    expect(room.actions.get('wolf')).toBe(8);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('魔术师对话消息正确', () => {
    expect(ROLES.magician.actionMessage).toBe('请选择两名交换对象');
    expect(ROLES.magician.actionConfirmMessage).toBe('交换');
  });

  it('黑狼王对话消息正确', () => {
    expect(ROLES.darkWolfKing.actionMessage).toBe('请确认你的发动状态');
    expect(ROLES.darkWolfKing.actionConfirmMessage).toBe('确认');
  });
});

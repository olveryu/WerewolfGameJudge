/**
 * 黑狼王守卫12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 黑狼王 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → wolf → witch → seer → hunter → darkWolfKing
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  proceedToNextAction,
  getNightResult,
} from '../../Room';
import { createTemplateFromRoles } from '../../Template';
import { RoleName, ROLES } from '../../../constants/roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '黑狼王守卫12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'darkWolfKing',
  'seer', 'witch', 'hunter', 'guard',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST003', template);
  
  ROLES_CONFIG.forEach((role, seat) => {
    room.players.set(seat, {
      uid: `player_${seat}`,
      seatNumber: seat,
      role,
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      displayName: `玩家${seat + 1}`,
    });
  });
  
  room.roomStatus = RoomStatus.ongoing;
  room.currentActionerIndex = 0;
  
  return room;
};

describe(`${TEMPLATE_NAME} - 行动顺序测试`, () => {
  it('应该有正确的行动顺序', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    expect(template.actionOrder).toEqual(['guard', 'wolf', 'witch', 'seer', 'hunter', 'darkWolfKing']);
  });

  it('应该按顺序进行完整流程', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 8); // 守卫守护预言家
    
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 0); // 狼人杀村民
    
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 4);
    
    expect(getCurrentActionRole(room)).toBe('hunter');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe('darkWolfKing');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe(null);
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 正常夜晚`, () => {
  it('狼人杀村民，无人守护', () => {
    let room = createTestRoom();
    
    // 守卫守护预言家
    room = proceedToNextAction(room, 8);
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 黑狼王确认
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 守卫守护成功`, () => {
  it('守卫守护的玩家不会死亡', () => {
    let room = createTestRoom();
    
    // 守卫守护0号村民
    room = proceedToNextAction(room, 0);
    
    // 狼人杀0号村民（被守护）
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 黑狼王确认
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers.length).toBe(0);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('黑狼王对话消息正确', () => {
    expect(ROLES.darkWolfKing.actionMessage).toBe('请确认你的发动状态');
    expect(ROLES.darkWolfKing.actionConfirmMessage).toBe('确认');
  });
});

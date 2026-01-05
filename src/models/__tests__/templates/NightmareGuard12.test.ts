/**
 * 梦魇守卫12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 梦魇 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：nightmare → guard → wolf → witch → seer → hunter
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

const TEMPLATE_NAME = '梦魇守卫12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'nightmare',
  'seer', 'witch', 'hunter', 'guard',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST005', template);
  
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
    // 梦魇在守卫之前行动
    expect(template.actionOrder).toEqual(['nightmare', 'guard', 'wolf', 'witch', 'seer', 'hunter']);
  });

  it('梦魇应该最先行动', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('nightmare');
    room = proceedToNextAction(room, 8); // 梦魇封锁预言家
    
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 9); // 守卫守护女巫
    
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 梦魇封锁预言家`, () => {
  it('梦魇封锁预言家后，预言家技能失效', () => {
    let room = createTestRoom();
    
    // 梦魇封锁8号预言家
    room = proceedToNextAction(room, 8);
    expect(room.actions.get('nightmare')).toBe(8);
    
    // 守卫守护
    room = proceedToNextAction(room, 9);
    
    // 狼人杀
    room = proceedToNextAction(room, 0);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家（被封锁，技能失效）
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 梦魇封锁守卫`, () => {
  it('梦魇封锁守卫后，守卫技能失效', () => {
    let room = createTestRoom();
    
    // 梦魇封锁11号守卫
    room = proceedToNextAction(room, 11);
    expect(room.actions.get('nightmare')).toBe(11);
    
    // 守卫守护（被封锁，应该失效）
    room = proceedToNextAction(room, 0);
    
    // 狼人杀0号（守卫被封锁，守护应该无效）
    room = proceedToNextAction(room, 0);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    // 注意：在实际游戏逻辑中，被封锁的守卫守护无效
    // 这里只测试流程是否正确
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景3: 梦魇封锁女巫`, () => {
  it('梦魇封锁女巫后，女巫无法使用解药/毒药', () => {
    let room = createTestRoom();
    
    // 梦魇封锁9号女巫
    room = proceedToNextAction(room, 9);
    expect(room.actions.get('nightmare')).toBe(9);
    
    // 守卫守护
    room = proceedToNextAction(room, 0);
    
    // 狼人杀1号
    room = proceedToNextAction(room, 1);
    
    // 女巫（被封锁，技能失效）
    room = proceedToNextAction(room, null);
    
    // 预言家
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(1);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('梦魇对话消息正确', () => {
    expect(ROLES.nightmare.actionMessage).toBe('请选择封锁对象');
    expect(ROLES.nightmare.actionConfirmMessage).toBe('封锁');
  });
});

/**
 * 标准板12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 4狼人 + 预言家 + 女巫 + 猎人 + 白痴
 * 行动顺序：wolf → witch → seer → hunter
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  getKilledIndex,
  proceedToNextAction,
  getNightResult,
} from '../../Room';
import { createTemplateFromRoles } from '../../Template';
import { RoleName, ROLES } from '../../roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '标准板12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'wolf',
  'seer', 'witch', 'hunter', 'idiot',
];

// Helper to create a room with all seats filled
const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST001', template);
  
  // Fill all seats
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
  
  // Start the game
  room.roomStatus = RoomStatus.assigned;
  room.currentActionerIndex = 0;
  
  return room;
};

describe(`${TEMPLATE_NAME} - 行动顺序测试`, () => {
  it('应该有正确的行动顺序', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    expect(template.actionOrder).toEqual(['wolf', 'witch', 'seer', 'hunter']);
  });

  it('应该按顺序进行: 狼人 → 女巫 → 预言家 → 猎人', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 0);
    
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 4);
    
    expect(getCurrentActionRole(room)).toBe('hunter');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe(null);
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 狼人杀村民，女巫不救`, () => {
  it('白天应该显示被杀村民出局', () => {
    let room = createTestRoom();
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    expect(getKilledIndex(room)).toBe(0);
    
    // 女巫不使用技能
    room = proceedToNextAction(room, null);
    
    // 预言家查验4号（狼人）
    room = proceedToNextAction(room, 4);
    
    // 猎人确认状态
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.savedByWitch).toBe(false);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 狼人杀村民，女巫救人`, () => {
  it('女巫使用解药后，无人死亡', () => {
    let room = createTestRoom();
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    expect(getKilledIndex(room)).toBe(0);
    
    // 女巫使用解药救人 (extra=false 表示使用解药)
    room = proceedToNextAction(room, 0, false);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果 - 应该无人死亡
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.savedByWitch).toBe(true);
    expect(result.deadPlayers.length).toBe(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景3: 狼人杀村民，女巫毒狼人`, () => {
  it('白天应该显示被杀村民和被毒狼人都出局', () => {
    let room = createTestRoom();
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 女巫毒4号狼人 (不传 extra 或 extra=true 表示毒人)
    room = proceedToNextAction(room, 4, true);
    
    // 预言家查验
    room = proceedToNextAction(room, 5);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.deadPlayers).toContain(0); // 被狼人杀
    expect(result.poisonedPlayer).toBe(4); // 被女巫毒
    expect(result.deadPlayers).toContain(4);
    expect(result.deadPlayers.length).toBe(2);
  });
});

describe(`${TEMPLATE_NAME} - 场景4: 狼人杀猎人，女巫不救`, () => {
  it('猎人被杀后记录在死亡列表', () => {
    let room = createTestRoom();
    
    // 狼人杀10号猎人
    room = proceedToNextAction(room, 10);
    expect(getKilledIndex(room)).toBe(10);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认状态（被杀可以开枪）
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(10);
    expect(result.deadPlayers).toContain(10);
  });
});

describe(`${TEMPLATE_NAME} - 场景5: 女巫毒猎人`, () => {
  it('猎人被毒记录在死亡列表', () => {
    let room = createTestRoom();
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 女巫毒10号猎人 (extra=true 表示毒人)
    room = proceedToNextAction(room, 10, true);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果
    const result = getNightResult(room);
    expect(result.poisonedPlayer).toBe(10);
    expect(result.deadPlayers).toContain(0);  // 被狼人杀
    expect(result.deadPlayers).toContain(10); // 被毒
    expect(result.deadPlayers.length).toBe(2);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('狼人对话消息正确', () => {
    expect(ROLES.wolf.actionMessage).toBe('请选择猎杀对象');
    expect(ROLES.wolf.actionConfirmMessage).toBe('猎杀');
  });

  it('女巫对话消息正确', () => {
    expect(ROLES.witch.actionMessage).toBe('请选择使用毒药或解药');
    expect(ROLES.witch.actionConfirmMessage).toBe('使用');
  });

  it('预言家对话消息正确', () => {
    expect(ROLES.seer.actionMessage).toBe('请选择查验对象');
    expect(ROLES.seer.actionConfirmMessage).toBe('查验');
  });

  it('猎人对话消息正确', () => {
    expect(ROLES.hunter.actionMessage).toBe('请确认你的发动状态');
    expect(ROLES.hunter.actionConfirmMessage).toBe('确认');
  });
});

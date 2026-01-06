/**
 * 狼美守卫12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 狼美人 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → wolf → wolfQueen → witch → seer → hunter
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

const TEMPLATE_NAME = '狼美守卫12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'wolfQueen',
  'seer', 'witch', 'hunter', 'guard',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST002', template);
  
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
    expect(template.actionOrder).toEqual(['guard', 'wolf', 'wolfQueen', 'witch', 'seer', 'hunter']);
  });

  it('应该按顺序进行: 守卫 → 狼人 → 狼美人 → 女巫 → 预言家 → 猎人', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 0); // 守卫守护0号
    
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 1); // 狼人杀1号
    
    expect(getCurrentActionRole(room)).toBe('wolfQueen');
    room = proceedToNextAction(room, 8); // 狼美人魅惑预言家
    
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 4);
    
    expect(getCurrentActionRole(room)).toBe('hunter');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe(null);
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 守卫守护成功`, () => {
  it('守卫守护的玩家被狼人杀时应该存活', () => {
    let room = createTestRoom();
    
    // 守卫守护0号村民
    room = proceedToNextAction(room, 0);
    
    // 狼人杀0号村民（被守卫守护）
    room = proceedToNextAction(room, 0);
    
    // 狼美人魅惑
    room = proceedToNextAction(room, null);
    
    // 女巫不使用技能
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果 - 0号被守护应该存活
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.deadPlayers).not.toContain(0);
    expect(result.deadPlayers.length).toBe(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 守卫守护其他人，狼人杀村民`, () => {
  it('未被守护的玩家应该死亡', () => {
    let room = createTestRoom();
    
    // 守卫守护8号预言家
    room = proceedToNextAction(room, 8);
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 狼美人魅惑
    room = proceedToNextAction(room, null);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景3: 狼美人魅惑预言家`, () => {
  it('狼美人应该成功记录魅惑对象', () => {
    let room = createTestRoom();
    
    // 守卫守护
    room = proceedToNextAction(room, 0);
    
    // 狼人杀
    room = proceedToNextAction(room, 1);
    
    // 狼美人魅惑8号预言家
    room = proceedToNextAction(room, 8);
    
    // 检查狼美人的行动被记录
    expect(room.actions.get('wolfQueen')).toBe(8);
  });
});

describe(`${TEMPLATE_NAME} - 场景4: 同守必死`, () => {
  it('被刀的人同时被女巫救和守卫守护时应该死亡', () => {
    let room = createTestRoom();
    
    // 守卫守护0号村民
    room = proceedToNextAction(room, 0);
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 狼美人不魅惑
    room = proceedToNextAction(room, null);
    
    // 女巫救0号村民 (extra=false 表示使用解药)
    room = proceedToNextAction(room, 0, false);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 检查夜间结果 - 同守必死，0号应该死亡
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.savedByWitch).toBe(true);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('守卫对话消息正确', () => {
    expect(ROLES.guard.actionMessage).toBe('请选择守护对象');
    expect(ROLES.guard.actionConfirmMessage).toBe('守护');
  });

  it('狼美人对话消息正确', () => {
    expect(ROLES.wolfQueen.actionMessage).toBe('请选择魅惑对象');
    expect(ROLES.wolfQueen.actionConfirmMessage).toBe('魅惑');
  });
});

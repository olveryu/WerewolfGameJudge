/**
 * 机械狼通灵师12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 机械狼 + 通灵师 + 女巫 + 猎人 + 守卫
 * 行动顺序：wolfRobot → guard → wolf → witch → psychic → hunter
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
import { RoleName, ROLES } from '../../roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '机械狼通灵师12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'wolfRobot',
  'psychic', 'witch', 'hunter', 'guard',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST009', template);
  
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
    // 机械狼最早行动（学习技能）
    expect(template.actionOrder).toEqual(['wolfRobot', 'guard', 'wolf', 'witch', 'psychic', 'hunter']);
  });

  it('机械狼应该最先行动', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('wolfRobot');
    room = proceedToNextAction(room, 8); // 机械狼学习通灵师
    
    expect(getCurrentActionRole(room)).toBe('guard');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 机械狼学习技能`, () => {
  it('机械狼学习通灵师技能', () => {
    let room = createTestRoom();
    
    // 机械狼学习8号通灵师
    room = proceedToNextAction(room, 8);
    expect(room.actions.get('wolfRobot')).toBe(8);
    
    // 守卫守护
    room = proceedToNextAction(room, 0);
    
    // 狼人杀人
    room = proceedToNextAction(room, 3);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 通灵师
    room = proceedToNextAction(room, null);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(3);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 守卫保护狼刀目标`, () => {
  it('守卫成功保护村民', () => {
    let room = createTestRoom();
    
    // 机械狼学习守卫技能
    room = proceedToNextAction(room, 11);
    
    // 守卫守护0号村民
    room = proceedToNextAction(room, 0);
    expect(room.actions.get('guard')).toBe(0);
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 通灵师
    room = proceedToNextAction(room, null);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    // 守卫保护成功，0号村民存活
    expect(result.deadPlayers).not.toContain(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景3: 通灵师验人`, () => {
  it('通灵师验证已死亡玩家身份', () => {
    let room = createTestRoom();
    
    // 机械狼
    room = proceedToNextAction(room, null);
    
    // 守卫
    room = proceedToNextAction(room, 1);
    
    // 狼人杀0号
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 通灵师验0号（被杀村民）
    room = proceedToNextAction(room, 0);
    expect(room.actions.get('psychic')).toBe(0);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
  });
});

describe(`${TEMPLATE_NAME} - 角色对话消息测试`, () => {
  it('机械狼对话消息正确', () => {
    expect(ROLES.wolfRobot.actionMessage).toBe('请选择学习对象');
    expect(ROLES.wolfRobot.actionConfirmMessage).toBe('学习');
  });

  it('机械狼描述正确（与普通狼人互不相认）', () => {
    expect(ROLES.wolfRobot.description).toContain('互不相认');
    expect(ROLES.wolfRobot.description).toContain('学习');
  });

  it('通灵师对话消息正确', () => {
    expect(ROLES.psychic.actionMessage).toBe('请选择查验对象');
    expect(ROLES.psychic.actionConfirmMessage).toBe('查验');
  });
});

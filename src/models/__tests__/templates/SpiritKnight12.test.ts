/**
 * 恶灵骑士12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 恶灵骑士 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → wolf → witch → seer → hunter
 * 
 * 恶灵骑士特性：
 * - 永久免疫夜间伤害（无法自刀、吃毒不死）
 * - 被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）
 * - 不能自爆，只能被放逐或猎人枪杀
 */

import { 
  Room, 
  RoomStatus,
  createRoom, 
  getCurrentActionRole,
  proceedToNextAction,
  getNightResult,
  getLastNightInfo,
} from '../../Room';
import { createTemplateFromRoles } from '../../Template';
import { RoleName, ROLES, hasNightAction } from '../../roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '恶灵骑士12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'spiritKnight',
  'seer', 'witch', 'hunter', 'guard',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST010', template);
  
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
  it('应该有正确的行动顺序（恶灵骑士无夜间行动）', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    // 恶灵骑士没有夜间行动
    expect(template.actionOrder).toEqual(['guard', 'wolf', 'witch', 'seer', 'hunter']);
  });

  it('应该按顺序进行: 守卫 → 狼人 → 女巫 → 预言家 → 猎人', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('guard');
    room = proceedToNextAction(room, 0);
    
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 1);
    
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 7); // 查验恶灵骑士
    
    expect(getCurrentActionRole(room)).toBe('hunter');
    room = proceedToNextAction(room, null);
    
    expect(getCurrentActionRole(room)).toBe(null);
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 标准夜晚`, () => {
  it('狼人杀村民，无特殊事件', () => {
    let room = createTestRoom();
    
    // 守卫守护预言家
    room = proceedToNextAction(room, 8);
    
    // 狼人杀0号村民
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验狼人
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.killedByWolf).toBe(0);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 守卫守护恶灵骑士`, () => {
  it('守卫守护恶灵骑士不会触发反伤', () => {
    let room = createTestRoom();
    
    // 守卫守护7号恶灵骑士
    room = proceedToNextAction(room, 7);
    expect(room.actions.get('guard')).toBe(7);
    
    // 狼人杀村民
    room = proceedToNextAction(room, 0);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验普通狼人
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    // 守卫守护恶灵骑士没有问题
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景3: 预言家查验恶灵骑士（反伤）`, () => {
  it('预言家查验恶灵骑士，预言家应该触发反伤死亡', () => {
    let room = createTestRoom();
    
    // 守卫守护
    room = proceedToNextAction(room, 0);
    
    // 狼人杀村民
    room = proceedToNextAction(room, 1);
    
    // 女巫不救
    room = proceedToNextAction(room, null);
    
    // 预言家查验7号恶灵骑士 - 触发反伤
    room = proceedToNextAction(room, 7);
    expect(room.actions.get('seer')).toBe(7);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.protectedBySeer).toBe(7);
  // Seer dies by reflection when checking spirit knight
  expect(result.deadPlayers).toContain(8);

  const info = getLastNightInfo(room);
  expect(info).toContain('9号');
  expect(info).not.toContain('8号');
  });
});

describe(`${TEMPLATE_NAME} - 场景4: 女巫毒恶灵骑士（反伤）`, () => {
  it('女巫毒恶灵骑士，女巫应该触发反伤死亡，毒药无效', () => {
    let room = createTestRoom();
    
    // 守卫守护
    room = proceedToNextAction(room, 0);
    
    // 狼人杀村民
    room = proceedToNextAction(room, 1);
    
    // 女巫毒7号恶灵骑士 - 触发反伤，毒药无效
    room = proceedToNextAction(room, 7, true);
    expect(room.actions.get('witch')).toBe(-8); // -(7+1) = -8 表示毒7号
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 猎人确认
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.poisonedPlayer).toBe(7);
  // Witch dies by reflection when poisoning spirit knight
  expect(result.deadPlayers).toContain(9);
  // Spirit knight does not die
  expect(result.deadPlayers).not.toContain(7);

  const info = getLastNightInfo(room);
  expect(info).toContain('10号');
  expect(info).not.toContain('8号');
  });
});

describe(`${TEMPLATE_NAME} - 角色特性测试`, () => {
  it('恶灵骑士没有夜间行动', () => {
    expect(hasNightAction('spiritKnight')).toBe(false);
  });

  it('恶灵骑士是狼人阵营', () => {
    expect(ROLES.spiritKnight.type).toBe('wolf');
  });

  it('恶灵骑士描述应该包含免疫和反伤', () => {
    expect(ROLES.spiritKnight.description).toContain('免疫夜间伤害');
    expect(ROLES.spiritKnight.description).toContain('反伤');
  });
});

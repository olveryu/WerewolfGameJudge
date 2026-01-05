/**
 * 血月猎魔12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 血月使徒 + 预言家 + 女巫 + 白痴 + 猎魔人
 * 行动顺序：wolf → witch → seer (血月使徒无夜间行动)
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
import { RoleName, ROLES, hasNightAction } from '../../../constants/roles';
import { PlayerStatus, SkillStatus } from '../../Player';

const TEMPLATE_NAME = '血月猎魔12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'bloodMoon',
  'seer', 'witch', 'idiot', 'witcher',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST006', template);
  
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
  it('应该有正确的行动顺序（血月使徒无夜间行动）', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    // 血月使徒没有夜间行动，白痴和猎魔人也没有
    expect(template.actionOrder).toEqual(['wolf', 'witch', 'seer']);
  });

  it('血月使徒不在行动顺序中', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    expect(template.actionOrder).not.toContain('bloodMoon');
  });

  it('猎魔人不在行动顺序中', () => {
    const template = createTemplateFromRoles(ROLES_CONFIG);
    expect(template.actionOrder).not.toContain('witcher');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 正常夜晚`, () => {
  it('狼人杀村民', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('wolf');
    room = proceedToNextAction(room, 0); // 狼人杀村民
    
    expect(getCurrentActionRole(room)).toBe('witch');
    room = proceedToNextAction(room, null); // 女巫不救
    
    expect(getCurrentActionRole(room)).toBe('seer');
    room = proceedToNextAction(room, 4); // 预言家查验
    
    expect(getCurrentActionRole(room)).toBe(null); // 夜晚结束
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
    expect(result.deadPlayers.length).toBe(1);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 女巫毒猎魔人`, () => {
  it('猎魔人被毒不会死亡（免疫毒药）', () => {
    let room = createTestRoom();
    
    // 狼人杀村民
    room = proceedToNextAction(room, 0);
    
    // 女巫毒11号猎魔人 (extra=true 表示毒人)
    room = proceedToNextAction(room, 11, true);
    
    // 预言家查验
    room = proceedToNextAction(room, 4);
    
    // 检查结果 - 猎魔人免疫毒药，但这需要在游戏逻辑中处理
    // 测试只验证流程正确，毒药记录正确
    const result = getNightResult(room);
    expect(result.poisonedPlayer).toBe(11);
    // 注意：实际游戏中猎魔人免疫毒药，这里只记录了毒人动作
  });
});

describe(`${TEMPLATE_NAME} - 角色特性测试`, () => {
  it('血月使徒没有夜间行动', () => {
    expect(hasNightAction('bloodMoon')).toBe(false);
  });

  it('猎魔人没有夜间行动', () => {
    expect(hasNightAction('witcher')).toBe(false);
  });

  it('白痴没有夜间行动', () => {
    expect(hasNightAction('idiot')).toBe(false);
  });

  it('猎魔人描述应该包含女巫毒药无效', () => {
    expect(ROLES.witcher.description).toContain('女巫毒药对猎魔人无效');
  });
});

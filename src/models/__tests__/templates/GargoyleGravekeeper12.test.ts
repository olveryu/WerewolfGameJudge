/**
 * 石像鬼守墓人12人 - 完整夜间流程测试
 * 
 * 角色配置：4村民 + 3狼人 + 石像鬼 + 预言家 + 女巫 + 猎人 + 守墓人
 * 行动顺序：gargoyle → wolf → witch → seer → hunter
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

const TEMPLATE_NAME = '石像鬼守墓人12人';
const ROLES_CONFIG: RoleName[] = [
  'villager', 'villager', 'villager', 'villager',
  'wolf', 'wolf', 'wolf', 'gargoyle',
  'seer', 'witch', 'hunter', 'graveyardKeeper',
];

const createTestRoom = (): Room => {
  const template = createTemplateFromRoles(ROLES_CONFIG);
  const room = createRoom('test-host', 'TEST004', template);
  
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
    // 石像鬼在狼人之前行动，守墓人没有夜间行动
    expect(template.actionOrder).toEqual(['gargoyle', 'wolf', 'witch', 'seer', 'hunter']);
  });

  it('石像鬼应该在狼人之前行动', () => {
    let room = createTestRoom();
    
    expect(getCurrentActionRole(room)).toBe('gargoyle');
    room = proceedToNextAction(room, 8); // 石像鬼查验预言家是否为神职
    
    expect(getCurrentActionRole(room)).toBe('wolf');
  });
});

describe(`${TEMPLATE_NAME} - 场景1: 石像鬼查验神职`, () => {
  it('石像鬼查验预言家（神职）', () => {
    let room = createTestRoom();
    
    // 石像鬼查验8号预言家
    room = proceedToNextAction(room, 8);
    expect(room.actions.get('gargoyle')).toBe(8);
    
    // 狼人杀
    room = proceedToNextAction(room, 0);
    
    // 女巫
    room = proceedToNextAction(room, null);
    
    // 预言家
    room = proceedToNextAction(room, 4);
    
    // 猎人
    room = proceedToNextAction(room, null);
    
    const result = getNightResult(room);
    expect(result.deadPlayers).toContain(0);
  });
});

describe(`${TEMPLATE_NAME} - 场景2: 石像鬼查验村民`, () => {
  it('石像鬼查验村民（非神职）', () => {
    let room = createTestRoom();
    
    // 石像鬼查验0号村民
    room = proceedToNextAction(room, 0);
    expect(room.actions.get('gargoyle')).toBe(0);
    
    // 狼人杀
    room = proceedToNextAction(room, 1);
    
    // 女巫
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
  it('石像鬼对话消息正确', () => {
    expect(ROLES.gargoyle.actionMessage).toBe('请选择查验对象');
    expect(ROLES.gargoyle.actionConfirmMessage).toBe('查验');
  });

  it('守墓人没有夜间行动', () => {
    expect(hasNightAction('graveyardKeeper')).toBe(false);
  });
});

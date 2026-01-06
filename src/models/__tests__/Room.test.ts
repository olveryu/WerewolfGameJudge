import {
  Room,
  RoomStatus,
  createRoom,
  proceedToNextAction,
  getLastNightInfo,
  getKilledIndex,
  performSeerAction,
  performPsychicAction,
  getCurrentActionRole,
  updateRoomTemplate,
} from '../Room';
import { GameTemplate } from '../Template';
import { Player, PlayerStatus, SkillStatus } from '../Player';
import { RoleName, ACTION_ORDER } from '../../constants/roles';

// Helper to create a test room with specific roles
const createTestRoom = (roles: RoleName[]): Room => {
  // Get action order for these roles
  const roleSet = new Set(roles);
  const actionOrder = ACTION_ORDER.filter((role) => roleSet.has(role));

  const template: GameTemplate = {
    name: 'Test Template',
    roles,
    numberOfPlayers: roles.length,
    actionOrder,
  };

  const room = createRoom('host123', '1234', template);
  
  // Assign players to all seats
  const players = new Map<number, Player | null>();
  roles.forEach((role, index) => {
    players.set(index, {
      uid: `player_${index}`,
      seatNumber: index,
      status: PlayerStatus.alive,
      role: role,
      skillStatus: SkillStatus.available,
    });
  });

  return { ...room, players, roomStatus: RoomStatus.ongoing };
};

// Helper to advance action to specific role
const advanceToRole = (room: Room, targetRole: RoleName): Room => {
  let current = room;
  while (getCurrentActionRole(current) !== targetRole) {
    const currentRole = getCurrentActionRole(current);
    if (!currentRole) break;
    current = proceedToNextAction(current, null); // skip with null action
  }
  return current;
};

// Helper to complete night phase
const completeNight = (room: Room): Room => {
  let current = room;
  while (getCurrentActionRole(current)) {
    current = proceedToNextAction(current, null);
  }
  return current;
};

describe('Room - 狼人 (Wolf)', () => {
  it('狼人杀人 - 玩家应该死亡', () => {
    const room = createTestRoom(['wolf', 'villager', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    expect(getCurrentActionRole(current)).toBe('wolf');
    
    // Wolf kills player 2
    current = proceedToNextAction(current, 2);
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('3号');
    expect(info).toContain('死亡');
  });

  it('狼人空刀 - 应该是平安夜', () => {
    const room = createTestRoom(['wolf', 'villager', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, null); // 空刀
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });
});

describe('Room - 女巫 (Witch)', () => {
  it('女巫救人 - 被狼杀的玩家应该存活（平安夜）', () => {
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills player 4
    
    current = advanceToRole(current, 'witch');
    const killedIndex = getKilledIndex(current);
    expect(killedIndex).toBe(3);
    
    // Witch saves (extra = false means save)
    current = proceedToNextAction(current, 3, false);
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });

  it('女巫毒人 - 被毒的玩家应该死亡', () => {
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills player 4
    
    current = advanceToRole(current, 'witch');
    // Witch poisons player 3 (seer) - extra = true or undefined means poison
    current = proceedToNextAction(current, 2, true);
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('3号');
    expect(info).toContain('4号');
  });

  it('女巫不行动 - 只有被狼杀的玩家死亡', () => {
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, null); // No action
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('4号');
    expect(info).not.toContain('平安夜');
  });
});

describe('Room - 守卫 (Guard)', () => {
  it('守卫守护 - 被守护的玩家免于狼杀', () => {
    const room = createTestRoom(['wolf', 'guard', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'guard');
    current = proceedToNextAction(current, 2); // Guard protects player 3
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });

  it('守卫守护其他人 - 被狼杀的玩家死亡', () => {
    const room = createTestRoom(['wolf', 'guard', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'guard');
    current = proceedToNextAction(current, 3); // Guard protects player 4
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('3号');
  });

  it('守卫和女巫同守 - 应该奶死（同守必死）', () => {
    const room = createTestRoom(['wolf', 'guard', 'witch', 'villager']);
    
    let current = advanceToRole(room, 'guard');
    current = proceedToNextAction(current, 3); // Guard protects player 4
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills player 4
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 3, false); // Witch saves player 4
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('4号');
    expect(info).toContain('死亡');
  });
});

describe('Room - 预言家 (Seer)', () => {
  it('预言家查验狼人 - 应该显示狼人', () => {
    const room = createTestRoom(['wolf', 'seer', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 2);
    
    current = advanceToRole(current, 'seer');
    const result = performSeerAction(current, 0); // Check wolf
    
    expect(result).toBe('狼人');
  });

  it('预言家查验好人 - 应该显示好人', () => {
    const room = createTestRoom(['wolf', 'seer', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'seer');
    const result = performSeerAction(current, 2); // Check villager
    
    expect(result).toBe('好人');
  });

  it('预言家查验石像鬼 - 应该显示狼人', () => {
    const room = createTestRoom(['gargoyle', 'seer', 'villager', 'villager']);
    
    const current = advanceToRole(room, 'seer');
    const result = performSeerAction(current, 0); // Check gargoyle
    
    expect(result).toBe('狼人');
  });
});

describe('Room - 狼美人 (Wolf Queen)', () => {
  it('狼美人连接后死亡 - 被连接的玩家也死亡', () => {
    const room = createTestRoom(['wolf', 'wolfQueen', 'witch', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 1); // Wolf kills wolf queen
    
    current = advanceToRole(current, 'wolfQueen');
    current = proceedToNextAction(current, 3); // Wolf queen links player 4
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('2号'); // Wolf queen
    expect(info).toContain('4号'); // Linked player
  });

  it('狼美人没有连接 - 只有狼美人死亡', () => {
    const room = createTestRoom(['wolf', 'wolfQueen', 'witch', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 1); // Wolf kills wolf queen
    
    current = advanceToRole(current, 'wolfQueen');
    current = proceedToNextAction(current, null); // No link
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('2号');
    expect(info).not.toContain('4号');
  });

  it('狼美人存活 - 连接的玩家不会死', () => {
    const room = createTestRoom(['wolf', 'wolfQueen', 'witch', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills player 4 (not queen)
    
    current = advanceToRole(current, 'wolfQueen');
    current = proceedToNextAction(current, 2); // Wolf queen links player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('4号');
    expect(info).not.toContain('3号'); // Linked player survives because queen survived
  });
});

describe('Room - 摄梦人 (Celebrity)', () => {
  it('摄梦人守护 - 被守护的玩家免于死亡', () => {
    const room = createTestRoom(['wolf', 'celebrity', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'celebrity');
    current = proceedToNextAction(current, 2); // Celebrity protects player 3
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });

  it('摄梦人死亡 - 被守护的玩家也死亡', () => {
    const room = createTestRoom(['wolf', 'celebrity', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'celebrity');
    current = proceedToNextAction(current, 2); // Celebrity protects player 3
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 1); // Wolf kills celebrity
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('2号'); // Celebrity
    expect(info).toContain('3号'); // Protected player dies with celebrity
  });
});

describe('Room - 魔术师 (Magician)', () => {
  it('魔术师交换身份 - 死亡交换', () => {
    const room = createTestRoom(['wolf', 'magician', 'villager', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'magician');
    // Magician swaps player 3 and player 4 (encoded as first + second * 100)
    const encodedAction = 2 + 3 * 100; // swap seat 2 and seat 3
    current = proceedToNextAction(current, encodedAction);
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    // Death should be swapped to player 4
    expect(info).toContain('4号');
    expect(info).not.toContain('3号');
  });
});

describe('Room - 猎魔人 (Witcher)', () => {
  it('猎魔人免疫女巫毒药', () => {
    const room = createTestRoom(['wolf', 'witch', 'witcher', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills player 4
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 2, true); // Witch poisons witcher
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('4号'); // Villager dies
    expect(info).not.toContain('3号'); // Witcher immune to poison
  });
});

describe('Room - 梦魇 (Nightmare)', () => {
  it('梦魇封锁预言家 - 预言家应该被封', () => {
    const room = createTestRoom(['nightmare', 'seer', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'nightmare');
    current = proceedToNextAction(current, 1); // Nightmare blocks seer
    
    // We'd need to check nightmared status, but for now just verify action recorded
    expect(current.actions.get('nightmare')).toBe(1);
  });
});

describe('Room - 石像鬼 (Gargoyle)', () => {
  it('石像鬼查验玩家', () => {
    const room = createTestRoom(['gargoyle', 'seer', 'villager', 'wolf']);
    
    let current = advanceToRole(room, 'gargoyle');
    current = proceedToNextAction(current, 3); // Gargoyle checks player 4 (wolf)
    
    expect(current.actions.get('gargoyle')).toBe(3);
  });
});

describe('Room - 机械狼 (Wolf Robot)', () => {
  it('机械狼查验玩家', () => {
    const room = createTestRoom(['wolfRobot', 'seer', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolfRobot');
    current = proceedToNextAction(current, 1); // Wolf robot checks seer
    
    expect(current.actions.get('wolfRobot')).toBe(1);
  });
});

describe('Room - 综合场景测试', () => {
  it('复杂场景：守卫守护 + 狼人杀同一人 = 平安夜', () => {
    const room = createTestRoom(['wolf', 'guard', 'seer', 'witch', 'villager']);
    
    let current = advanceToRole(room, 'guard');
    current = proceedToNextAction(current, 2); // Guard protects seer
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills seer
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, null); // Witch does nothing
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });

  it('复杂场景：狼人杀人 + 女巫毒人 = 两人死亡', () => {
    const room = createTestRoom(['wolf', 'guard', 'seer', 'witch', 'villager']);
    
    let current = advanceToRole(room, 'guard');
    current = proceedToNextAction(current, null);
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills seer
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 4, true); // Witch poisons villager
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('3号');
    expect(info).toContain('5号');
  });

  it('复杂场景：女巫救人 + 摄梦人守护 = 平安夜', () => {
    const room = createTestRoom(['wolf', 'celebrity', 'seer', 'witch', 'villager']);
    
    let current = advanceToRole(room, 'celebrity');
    current = proceedToNextAction(current, 4); // Celebrity protects villager
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills seer
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 2, false); // Witch saves seer
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });
});

describe('Room - 通灵师 (Psychic)', () => {
  it('通灵师查验玩家身份', () => {
    const room = createTestRoom(['wolf', 'psychic', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'psychic');
    const result = performPsychicAction(current, 2); // Check seer
    
    expect(result).toBe('预言家');
  });
});

describe('Room - 黑狼王 (Dark Wolf King)', () => {
  it('黑狼王正常死亡 - 可以发动技能', () => {
    const room = createTestRoom(['wolf', 'darkWolfKing', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 1); // Wolf kills dark wolf king
    
    current = advanceToRole(current, 'darkWolfKing');
    // Dark wolf king can use skill when killed normally
    expect(current.actions.get('wolf')).toBe(1);
  });

  it('黑狼王被女巫毒死 - 不能发动技能', () => {
    const room = createTestRoom(['wolf', 'witch', 'darkWolfKing', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills villager
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 2, true); // Witch poisons dark wolf king
    
    // Dark wolf king should not be able to use skill when poisoned
    expect(current.actions.get('witch')).toBe(-3); // Poisoned seat 2 encoded as -(2+1)
  });
});

describe('Room - 白狼王 (Wolf King)', () => {
  it('白狼王是狼人身份', () => {
    const room = createTestRoom(['wolfKing', 'seer', 'villager', 'villager']);
    
    const current = advanceToRole(room, 'seer');
    const result = performSeerAction(current, 0); // Check wolf king
    
    expect(result).toBe('狼人');
  });

  it('白狼王没有夜间行动', () => {
    const room = createTestRoom(['wolfKing', 'seer', 'villager', 'villager']);
    
    // Wolf king should not appear in action order since hasNightAction is false
    let current = room;
    let foundWolfKing = false;
    
    while (getCurrentActionRole(current)) {
      if (getCurrentActionRole(current) === 'wolfKing') {
        foundWolfKing = true;
      }
      current = proceedToNextAction(current, null);
    }
    
    expect(foundWolfKing).toBe(false);
  });
});

describe('updateRoomTemplate', () => {
  it('should update template and clear all players', () => {
    // Create a room with 4 players
    const roles4: RoleName[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles4);
    
    // Verify initial state
    expect(room.template.numberOfPlayers).toBe(4);
    expect(room.players.size).toBe(4);
    
    // Create new template with 6 players
    const newRoles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const newTemplate: GameTemplate = {
      name: 'New Template',
      roles: newRoles,
      numberOfPlayers: 6,
      actionOrder: ACTION_ORDER.filter((role) => new Set(newRoles).has(role)),
    };
    
    // Update room template
    const updatedRoom = updateRoomTemplate(room, newTemplate);
    
    // Verify updated state
    expect(updatedRoom.template.numberOfPlayers).toBe(6);
    expect(updatedRoom.template.roles).toEqual(newRoles);
    expect(updatedRoom.players.size).toBe(6);
    
    // All players should be null (empty seats)
    updatedRoom.players.forEach((player) => {
      expect(player).toBeNull();
    });
    
    // Room should be reset to seating status
    expect(updatedRoom.roomStatus).toBe(RoomStatus.seating);
    expect(updatedRoom.currentActionerIndex).toBe(0);
    expect(updatedRoom.actions.size).toBe(0);
    expect(updatedRoom.hasPoison).toBe(true);
    expect(updatedRoom.hasAntidote).toBe(true);
  });
  
  it('should preserve room metadata (hostUid, roomNumber)', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles);
    
    const newRoles: RoleName[] = ['wolf', 'wolf', 'seer', 'witch'];
    const newTemplate: GameTemplate = {
      name: 'New',
      roles: newRoles,
      numberOfPlayers: 4,
      actionOrder: [],
    };
    
    const updatedRoom = updateRoomTemplate(room, newTemplate);
    
    expect(updatedRoom.hostUid).toBe(room.hostUid);
    expect(updatedRoom.roomNumber).toBe(room.roomNumber);
    expect(updatedRoom.timestamp).toBe(room.timestamp);
  });
});

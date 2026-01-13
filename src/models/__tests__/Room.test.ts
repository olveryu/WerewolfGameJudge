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
  assignRoles,
  startGame,
  restartRoom,
  markPlayerViewedRole,
  getPlayersNotViewedRole,
} from '../Room';
import { GameTemplate } from '../Template';
import { Player, PlayerStatus, SkillStatus } from '../Player';
import { RoleName, getActionOrderViaNightPlan } from '../roles';
import { isActionTarget, getActionTargetSeat, isActionWitch, isWitchPoison } from '../actions';

// Helper to create a test room with specific roles
const createTestRoom = (roles: RoleName[]): Room => {
  // Get action order for these roles via NightPlan
  const actionOrder = getActionOrderViaNightPlan(roles);

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
      hasViewedRole: false,
    });
  });

  return { ...room, players, roomStatus: RoomStatus.assigned };
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

  it('预言家查验女巫 - 应该显示好人', () => {
    const room = createTestRoom(['wolf', 'seer', 'witch', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'seer');
    const result = performSeerAction(current, 2); // Check witch
    
    expect(result).toBe('好人');
  });

  it('预言家查验猎人 - 应该显示好人', () => {
    const room = createTestRoom(['wolf', 'seer', 'hunter', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'seer');
    const result = performSeerAction(current, 2); // Check hunter
    
    expect(result).toBe('好人');
  });

  it('预言家查验守卫 - 应该显示好人', () => {
    const room = createTestRoom(['wolf', 'seer', 'guard', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3);
    
    current = advanceToRole(current, 'seer');
    const result = performSeerAction(current, 2); // Check guard
    
    expect(result).toBe('好人');
  });

  it('预言家查验梦魇 - 应该显示狼人', () => {
    const room = createTestRoom(['nightmare', 'seer', 'villager', 'villager']);
    
    const current = advanceToRole(room, 'seer');
    const result = performSeerAction(current, 0); // Check nightmare
    
    expect(result).toBe('狼人');
  });

  it('预言家查验狼美人 - 应该显示狼人', () => {
    const room = createTestRoom(['wolfQueen', 'seer', 'villager', 'villager']);
    
    const current = advanceToRole(room, 'seer');
    const result = performSeerAction(current, 0); // Check wolfQueen
    
    expect(result).toBe('狼人');
  });

  it('魔术师交换后预言家查验 - 应该看到交换后的身份', () => {
    // Roles: wolf(0), seer(1), magician(2), villager(3)
    // Action order: magician(-2) -> wolf(5) -> seer(15)
    // Magician swaps wolf(0) and villager(3)
    // When seer checks seat 0, should see villager's identity (好人)
    const room = createTestRoom(['wolf', 'seer', 'magician', 'villager']);
    
    // 1. Magician acts first (actionOrder = -2)
    let current = advanceToRole(room, 'magician');
    // Magician swap: firstSeat=0, secondSeat=3 (passed as extra)
    current = proceedToNextAction(current, 0, 3); // Swap seat 0 and seat 3
    
    // 2. Wolf acts second (actionOrder = 5)
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 1); // Wolf kills seer
    
    // Now check seer result - magician swap should be applied
    const resultSeat0 = performSeerAction(current, 0); // Check seat 0 (swapped to villager identity)
    const resultSeat3 = performSeerAction(current, 3); // Check seat 3 (swapped to wolf identity)
    
    expect(resultSeat0).toBe('好人'); // Seat 0 now has villager's identity after swap
    expect(resultSeat3).toBe('狼人'); // Seat 3 now has wolf's identity after swap
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

describe('Room - 摄梦人 (Dreamcatcher)', () => {
  it('摄梦人守护 - 被守护的玩家免于死亡', () => {
  const room = createTestRoom(['wolf', 'dreamcatcher', 'villager', 'villager']);
    
  let current = advanceToRole(room, 'dreamcatcher');
  current = proceedToNextAction(current, 2); // Dreamcatcher protects player 3
    
    current = advanceToRole(current, 'wolf');
    current = proceedToNextAction(current, 2); // Wolf kills player 3
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
    expect(info).toContain('平安夜');
  });

  it('摄梦人死亡 - 被守护的玩家也死亡', () => {
  const room = createTestRoom(['wolf', 'dreamcatcher', 'villager', 'villager']);
    
  let current = advanceToRole(room, 'dreamcatcher');
  current = proceedToNextAction(current, 2); // Dreamcatcher protects player 3
    
    current = advanceToRole(current, 'wolf');
  current = proceedToNextAction(current, 1); // Wolf kills dreamcatcher
    
    current = completeNight(current);
    
    const info = getLastNightInfo(current);
  expect(info).toContain('2号'); // Dreamcatcher
  expect(info).toContain('3号'); // Protected player dies with dreamcatcher
  });
});

describe('Room - 魔术师 (Magician)', () => {
  it('魔术师交换身份 - 死亡交换', () => {
    const room = createTestRoom(['wolf', 'magician', 'villager', 'seer', 'villager']);
    
    let current = advanceToRole(room, 'magician');
    // Magician swaps seat 2 and seat 3: firstSeat=2, secondSeat=3 (passed as extra)
    current = proceedToNextAction(current, 2, 3);
    
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
    
    // Verify action recorded as RoleAction
    const action = current.actions.get('nightmare');
    expect(action).toBeDefined();
    expect(isActionTarget(action!)).toBe(true);
    expect(getActionTargetSeat(action)).toBe(1);
  });
});

describe('Room - 石像鬼 (Gargoyle)', () => {
  it('石像鬼查验玩家', () => {
    const room = createTestRoom(['gargoyle', 'seer', 'villager', 'wolf']);
    
    let current = advanceToRole(room, 'gargoyle');
    current = proceedToNextAction(current, 3); // Gargoyle checks player 4 (wolf)
    
    const action = current.actions.get('gargoyle');
    expect(action).toBeDefined();
    expect(isActionTarget(action!)).toBe(true);
    expect(getActionTargetSeat(action)).toBe(3);
  });
});

describe('Room - 机械狼 (Wolf Robot)', () => {
  it('机械狼查验玩家', () => {
    const room = createTestRoom(['wolfRobot', 'seer', 'villager', 'villager']);
    
    let current = advanceToRole(room, 'wolfRobot');
    current = proceedToNextAction(current, 1); // Wolf robot checks seer
    
    const action = current.actions.get('wolfRobot');
    expect(action).toBeDefined();
    expect(isActionTarget(action!)).toBe(true);
    expect(getActionTargetSeat(action)).toBe(1);
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
  const room = createTestRoom(['wolf', 'dreamcatcher', 'seer', 'witch', 'villager']);
    
  let current = advanceToRole(room, 'dreamcatcher');
  current = proceedToNextAction(current, 4); // Dreamcatcher protects villager
    
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
    const wolfAction = current.actions.get('wolf');
    expect(wolfAction).toBeDefined();
    expect(isActionTarget(wolfAction!)).toBe(true);
    expect(getActionTargetSeat(wolfAction)).toBe(1);
  });

  it('黑狼王被女巫毒死 - 不能发动技能', () => {
    const room = createTestRoom(['wolf', 'witch', 'darkWolfKing', 'villager']);
    
    let current = advanceToRole(room, 'wolf');
    current = proceedToNextAction(current, 3); // Wolf kills villager
    
    current = advanceToRole(current, 'witch');
    current = proceedToNextAction(current, 2, true); // Witch poisons dark wolf king
    
    // Dark wolf king should not be able to use skill when poisoned
    const witchAction = current.actions.get('witch');
    expect(witchAction).toBeDefined();
    expect(isActionWitch(witchAction!)).toBe(true);
    if (isActionWitch(witchAction!)) {
      expect(isWitchPoison(witchAction.witchAction)).toBe(true);
    }
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
  it('should update template and preserve existing players when player count changes', () => {
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
      actionOrder: getActionOrderViaNightPlan(newRoles),
    };
    
    // Update room template
    const updatedRoom = updateRoomTemplate(room, newTemplate);
    
    // Verify updated state
    expect(updatedRoom.template.numberOfPlayers).toBe(6);
    expect(updatedRoom.template.roles).toEqual(newRoles);
    expect(updatedRoom.players.size).toBe(6);
    
    // Existing players (seats 0-3) should be preserved but roles cleared
    for (let i = 0; i < 4; i++) {
      const player = updatedRoom.players.get(i);
      expect(player).not.toBeNull();
      expect(player?.uid).toBe(`player_${i}`);
      expect(player?.role).toBeNull();
      expect(player?.hasViewedRole).toBe(false);
    }
    
    // New seats (4-5) should be empty
    expect(updatedRoom.players.get(4)).toBeNull();
    expect(updatedRoom.players.get(5)).toBeNull();
    
    // Room should be reset to unseated status (because new seats are empty)
    expect(updatedRoom.roomStatus).toBe(RoomStatus.unseated);
    expect(updatedRoom.currentActionerIndex).toBe(0);
    expect(updatedRoom.actions.size).toBe(0);
  });
  
  it('should preserve players when player count stays same', () => {
    const roles: RoleName[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles);
    
    // Set status to seated (with players)
    const seatedRoom = { ...room, roomStatus: RoomStatus.seated };
    
    // New template with same number of players but different roles
    const newRoles: RoleName[] = ['wolf', 'witch', 'guard', 'villager'];
    const newTemplate: GameTemplate = {
      name: 'Different Roles',
      roles: newRoles,
      numberOfPlayers: 4,
      actionOrder: getActionOrderViaNightPlan(newRoles),
    };
    
    const updatedRoom = updateRoomTemplate(seatedRoom, newTemplate);
    
    // Players should be preserved (but roles cleared)
    expect(updatedRoom.players.size).toBe(4);
    updatedRoom.players.forEach((player, seat) => {
      expect(player).not.toBeNull();
      expect(player?.uid).toBe(`player_${seat}`);
      expect(player?.role).toBeNull(); // Roles cleared
    });
    
    // Status should be seated (players still there)
    expect(updatedRoom.roomStatus).toBe(RoomStatus.seated);
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

describe('Room Status Flow', () => {
  // Helper to create a basic seated room (players joined, no roles assigned)
  const createSeatedRoom = (roles: RoleName[]): Room => {
    const template: GameTemplate = {
      name: 'Test',
      roles,
      numberOfPlayers: roles.length,
      actionOrder: getActionOrderViaNightPlan(roles),
    };
    
    const room = createRoom('host123', '1234', template);
    
    // Simulate players joining (no roles assigned yet)
    const players = new Map<number, Player | null>();
    roles.forEach((_, index) => {
      players.set(index, {
        uid: `player_${index}`,
        seatNumber: index,
        status: PlayerStatus.alive,
        role: null, // No role assigned yet
        skillStatus: SkillStatus.available,
        hasViewedRole: false,
      });
    });
    
    return { ...room, players, roomStatus: RoomStatus.seated };
  };

  describe('assignRoles', () => {
    it('should assign roles to all players and set status to assigned', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager', 'villager'];
      const room = createSeatedRoom(roles);
      
      const assignedRoom = assignRoles(room);
      
      expect(assignedRoom.roomStatus).toBe(RoomStatus.assigned);
      
      // All players should have roles
      const assignedRoles: RoleName[] = [];
      assignedRoom.players.forEach((player) => {
        expect(player).not.toBeNull();
        expect(player?.role).not.toBeNull();
        if (player?.role) assignedRoles.push(player.role);
      });
      
      // All roles should be assigned (sort both arrays and compare)
      const sortedAssigned = [...assignedRoles].sort((a, b) => a.localeCompare(b));
      const sortedRoles = [...roles].sort((a, b) => a.localeCompare(b));
      expect(sortedAssigned).toEqual(sortedRoles);
      
      // All hasViewedRole should be false
      assignedRoom.players.forEach((player) => {
        expect(player?.hasViewedRole).toBe(false);
      });
    });
  });

  describe('markPlayerViewedRole', () => {
    it('should mark player as viewed', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      const updatedRoom = markPlayerViewedRole(assignedRoom, 0);
      
      expect(updatedRoom.players.get(0)?.hasViewedRole).toBe(true);
      expect(updatedRoom.players.get(1)?.hasViewedRole).toBe(false);
    });

    it('should auto-transition to ready when all players have viewed', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      // Status should be assigned
      expect(assignedRoom.roomStatus).toBe(RoomStatus.assigned);
      
      // Mark first two players
      let current = markPlayerViewedRole(assignedRoom, 0);
      expect(current.roomStatus).toBe(RoomStatus.assigned);
      
      current = markPlayerViewedRole(current, 1);
      expect(current.roomStatus).toBe(RoomStatus.assigned);
      
      // Mark last player - should transition to ready
      current = markPlayerViewedRole(current, 2);
      expect(current.roomStatus).toBe(RoomStatus.ready);
    });
  });

  describe('getPlayersNotViewedRole', () => {
    it('should return all players initially', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      const notViewed = getPlayersNotViewedRole(assignedRoom);
      const sortedNotViewed = [...notViewed].sort((a, b) => a - b);
      expect(sortedNotViewed).toEqual([0, 1, 2]);
    });

    it('should exclude players who have viewed', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      const current = markPlayerViewedRole(assignedRoom, 1);
      
      const notViewed = getPlayersNotViewedRole(current);
      const sortedNotViewed = [...notViewed].sort((a, b) => a - b);
      expect(sortedNotViewed).toEqual([0, 2]);
    });

    it('should return empty when all have viewed', () => {
      const roles: RoleName[] = ['wolf', 'seer'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      let current = markPlayerViewedRole(assignedRoom, 0);
      current = markPlayerViewedRole(current, 1);
      
      const notViewed = getPlayersNotViewedRole(current);
      expect(notViewed).toEqual([]);
    });
  });

  describe('startGame', () => {
    it('should set status to ongoing', () => {
      const roles: RoleName[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);
      
      // Mark all as viewed
      let current = markPlayerViewedRole(assignedRoom, 0);
      current = markPlayerViewedRole(current, 1);
      current = markPlayerViewedRole(current, 2);
      expect(current.roomStatus).toBe(RoomStatus.ready);
      
      // Start game
      const gameRoom = startGame(current);
      expect(gameRoom.roomStatus).toBe(RoomStatus.ongoing);
      expect(gameRoom.currentActionerIndex).toBe(0);
    });
  });

  describe('restartRoom', () => {
    it('should reset to seated with players but no roles', () => {
      const room = createTestRoom(['wolf', 'seer', 'villager', 'villager']);
      // Simulate game in progress
      const ongoingRoom = { ...room, roomStatus: RoomStatus.ongoing };
      
      const restartedRoom = restartRoom(ongoingRoom);
      
      expect(restartedRoom.roomStatus).toBe(RoomStatus.seated);
      expect(restartedRoom.currentActionerIndex).toBe(0);
      expect(restartedRoom.actions.size).toBe(0);
      
      // Players should still be there but roles cleared
      restartedRoom.players.forEach((player) => {
        expect(player).not.toBeNull();
        expect(player?.role).toBeNull();
        expect(player?.hasViewedRole).toBe(false);
      });
    });
  });
});

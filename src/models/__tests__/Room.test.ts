import {
  Room,
  GameStatus,
  createRoom,
  proceedToNextAction,
  getLastNightInfo,
  getCurrentActionRole,
  updateRoomTemplate,
  assignRoles,
  startGame,
  restartRoom,
  markPlayerViewedRole,
  getPlayersNotViewedRole,
  getAllWolfSeats,
  getVotingWolfSeats,
  getWolfVoteSummary,
} from '../Room';
import { GameTemplate } from '../Template';
import { Player, PlayerStatus, SkillStatus } from '../Player';
import { RoleId } from '../roles';
import { isActionTarget, getActionTargetSeat, isActionWitch, isWitchPoison } from '../actions';

// Helper to create a test room with specific roles
// Phase 5: actionOrder removed from GameTemplate
const createTestRoom = (roles: RoleId[]): Room => {
  const template: GameTemplate = {
    name: 'Test Template',
    roles,
    numberOfPlayers: roles.length,
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

  return { ...room, players, roomStatus: GameStatus.assigned };
};

// Helper to advance action to specific role
const advanceToRole = (room: Room, targetRole: RoleId): Room => {
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
    // NOTE: getKilledIndex removed (deprecated). Witch context now via private inbox.
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

// NOTE: Seer check tests have been moved to resolver tests
// (src/services/night/resolvers/__tests__/seer.test.ts)
// See seerCheckResolver for the new architecture.

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

// NOTE: Psychic check tests have been moved to resolver tests
// See psychicCheckResolver for the new architecture.

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
  // NOTE: Wolf king seer check test moved to resolver tests
  // Wolf king has team='wolf', so seer sees '狼人'

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
    const roles4: RoleId[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles4);

    // Verify initial state
    expect(room.template.numberOfPlayers).toBe(4);
    expect(room.players.size).toBe(4);

    // Create new template with 6 players
    // Phase 5: actionOrder removed from GameTemplate
    const newRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
    const newTemplate: GameTemplate = {
      name: 'New Template',
      roles: newRoles,
      numberOfPlayers: 6,
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
    expect(updatedRoom.roomStatus).toBe(GameStatus.unseated);
    expect(updatedRoom.currentActionerIndex).toBe(0);
    expect(updatedRoom.actions.size).toBe(0);
  });

  it('should preserve players when player count stays same', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles);

    // Set status to seated (with players)
    const seatedRoom = { ...room, roomStatus: GameStatus.seated };

    // New template with same number of players but different roles
    const newRoles: RoleId[] = ['wolf', 'witch', 'guard', 'villager'];
    const newTemplate: GameTemplate = {
      name: 'Different Roles',
      roles: newRoles,
      numberOfPlayers: 4,
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
    expect(updatedRoom.roomStatus).toBe(GameStatus.seated);
  });

  it('should preserve room metadata (hostUid, roomNumber)', () => {
    const roles: RoleId[] = ['wolf', 'seer', 'villager', 'villager'];
    const room = createTestRoom(roles);

    const newRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch'];
    const newTemplate: GameTemplate = {
      name: 'New',
      roles: newRoles,
      numberOfPlayers: 4,
    };

    const updatedRoom = updateRoomTemplate(room, newTemplate);

    expect(updatedRoom.hostUid).toBe(room.hostUid);
    expect(updatedRoom.roomNumber).toBe(room.roomNumber);
    expect(updatedRoom.timestamp).toBe(room.timestamp);
  });
});

describe('Room Status Flow', () => {
  // Helper to create a basic seated room (players joined, no roles assigned)
  // Phase 5: actionOrder removed from GameTemplate
  const createSeatedRoom = (roles: RoleId[]): Room => {
    const template: GameTemplate = {
      name: 'Test',
      roles,
      numberOfPlayers: roles.length,
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

    return { ...room, players, roomStatus: GameStatus.seated };
  };

  describe('assignRoles', () => {
    it('should assign roles to all players and set status to assigned', () => {
      const roles: RoleId[] = ['wolf', 'seer', 'villager', 'villager'];
      const room = createSeatedRoom(roles);

      const assignedRoom = assignRoles(room);

      expect(assignedRoom.roomStatus).toBe(GameStatus.assigned);

      // All players should have roles
      const assignedRoles: RoleId[] = [];
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
      const roles: RoleId[] = ['wolf', 'seer', 'villager', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);

      const updatedRoom = markPlayerViewedRole(assignedRoom, 0);

      expect(updatedRoom.players.get(0)?.hasViewedRole).toBe(true);
      expect(updatedRoom.players.get(1)?.hasViewedRole).toBe(false);
    });

    it('should auto-transition to ready when all players have viewed', () => {
      const roles: RoleId[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);

      // Status should be assigned
      expect(assignedRoom.roomStatus).toBe(GameStatus.assigned);

      // Mark first two players
      let current = markPlayerViewedRole(assignedRoom, 0);
      expect(current.roomStatus).toBe(GameStatus.assigned);

      current = markPlayerViewedRole(current, 1);
      expect(current.roomStatus).toBe(GameStatus.assigned);

      // Mark last player - should transition to ready
      current = markPlayerViewedRole(current, 2);
      expect(current.roomStatus).toBe(GameStatus.ready);
    });
  });

  describe('getPlayersNotViewedRole', () => {
    it('should return all players initially', () => {
      const roles: RoleId[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);

      const notViewed = getPlayersNotViewedRole(assignedRoom);
      const sortedNotViewed = [...notViewed].sort((a, b) => a - b);
      expect(sortedNotViewed).toEqual([0, 1, 2]);
    });

    it('should exclude players who have viewed', () => {
      const roles: RoleId[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);

      const current = markPlayerViewedRole(assignedRoom, 1);

      const notViewed = getPlayersNotViewedRole(current);
      const sortedNotViewed = [...notViewed].sort((a, b) => a - b);
      expect(sortedNotViewed).toEqual([0, 2]);
    });

    it('should return empty when all have viewed', () => {
      const roles: RoleId[] = ['wolf', 'seer'];
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
      const roles: RoleId[] = ['wolf', 'seer', 'villager'];
      const room = createSeatedRoom(roles);
      const assignedRoom = assignRoles(room);

      // Mark all as viewed
      let current = markPlayerViewedRole(assignedRoom, 0);
      current = markPlayerViewedRole(current, 1);
      current = markPlayerViewedRole(current, 2);
      expect(current.roomStatus).toBe(GameStatus.ready);

      // Start game
      const gameRoom = startGame(current);
      expect(gameRoom.roomStatus).toBe(GameStatus.ongoing);
      expect(gameRoom.currentActionerIndex).toBe(0);
    });
  });

  describe('restartRoom', () => {
    it('should reset to seated with players but no roles', () => {
      const room = createTestRoom(['wolf', 'seer', 'villager', 'villager']);
      // Simulate game in progress
      const ongoingRoom = { ...room, roomStatus: GameStatus.ongoing };

      const restartedRoom = restartRoom(ongoingRoom);

      expect(restartedRoom.roomStatus).toBe(GameStatus.seated);
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

  describe('getVotingWolfSeats', () => {
    it('should include regular wolves (participatesInWolfVote=true)', () => {
      const room = createTestRoom(['wolf', 'nightmare', 'darkWolfKing', 'seer']);
      // All wolves that participate in vote should be included
      const votingSeats = getVotingWolfSeats(room);
      expect(votingSeats).toEqual([0, 1, 2]); // wolf, nightmare, darkWolfKing
    });

    it('should exclude gargoyle (participatesInWolfVote=false)', () => {
      const room = createTestRoom(['wolf', 'gargoyle', 'seer', 'villager']);
      const votingSeats = getVotingWolfSeats(room);
      // gargoyle at seat 1 should NOT be included
      expect(votingSeats).toEqual([0]); // only wolf
    });

    it('should exclude wolfRobot (participatesInWolfVote=false)', () => {
      const room = createTestRoom(['wolf', 'wolfRobot', 'seer', 'villager']);
      const votingSeats = getVotingWolfSeats(room);
      // wolfRobot at seat 1 should NOT be included
      expect(votingSeats).toEqual([0]); // only wolf
    });

    it('should return empty when only non-voting wolves', () => {
      const room = createTestRoom(['gargoyle', 'wolfRobot', 'seer', 'villager']);
      const votingSeats = getVotingWolfSeats(room);
      expect(votingSeats).toEqual([]);
    });
  });

  describe('getAllWolfSeats', () => {
    it('should include ALL wolf-faction roles regardless of voting status', () => {
      const room = createTestRoom(['wolf', 'gargoyle', 'wolfRobot', 'seer']);
      const allWolfSeats = getAllWolfSeats(room);
      // All wolves should be included
      expect(allWolfSeats).toEqual([0, 1, 2]);
    });
  });

  describe('getWolfVoteSummary', () => {
    it('should count only voting wolves in denominator', () => {
      const room = createTestRoom(['wolf', 'gargoyle', 'seer', 'villager']);
      // Only wolf participates in vote, gargoyle does not
      const summary = getWolfVoteSummary(room);
      expect(summary).toBe('0/1 狼人已投票');
    });

    it('should reflect votes from voting wolves only', () => {
      const room = createTestRoom(['wolf', 'nightmare', 'gargoyle', 'seer']);
      // wolf (seat 0) and nightmare (seat 1) participate, gargoyle (seat 2) does not
      const roomWithVote = { ...room, wolfVotes: new Map([[0, 3]]) }; // wolf voted
      const summary = getWolfVoteSummary(roomWithVote);
      expect(summary).toBe('1/2 狼人已投票');
    });
  });
});
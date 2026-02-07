import {
  GameRoomLike,
  getLastNightInfo,
  getPlayersNotViewedRole,
  getWolfVoteSummary,
} from '../Room';
import { GameTemplate } from '../Template';
import { RoleId } from '../roles';
import {
  RoleAction,
  makeActionTarget,
  makeActionWitch,
  makeWitchSave,
  makeWitchPoison,
  makeActionMagicianSwap,
} from '../actions';

// Helper to create a test room with specific roles and pre-set actions
const createTestRoom = (
  roles: RoleId[],
  actions: Map<RoleId, RoleAction> = new Map(),
  wolfVotes: Map<number, number> = new Map(),
): GameRoomLike => {
  const template: GameTemplate = {
    name: 'Test Template',
    roles,
    numberOfPlayers: roles.length,
  };

  const players = new Map<
    number,
    { uid: string; seatNumber: number; role: RoleId | null; hasViewedRole: boolean } | null
  >();
  roles.forEach((role, index) => {
    players.set(index, {
      uid: `player_${index}`,
      seatNumber: index,
      role,
      hasViewedRole: false,
    });
  });

  return {
    template,
    players,
    actions,
    wolfVotes,
    currentActionerIndex: 0,
  };
};

describe('Room - 狼人 (Wolf)', () => {
  it('狼人杀人 - 玩家应该死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seat 2 (player 3)
    const room = createTestRoom(['wolf', 'villager', 'villager', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('3号');
    expect(info).toContain('死亡');
  });

  it('狼人空刀 - 应该是平安夜', () => {
    const room = createTestRoom(['wolf', 'villager', 'villager', 'villager']);

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });
});

describe('Room - 女巫 (Witch)', () => {
  it('女巫救人 - 被狼杀的玩家应该存活（平安夜）', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3
    actions.set('witch', makeActionWitch(makeWitchSave(3))); // Witch saves seat 3
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });

  it('女巫毒人 - 被毒的玩家应该死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3
    actions.set('witch', makeActionWitch(makeWitchPoison(2))); // Witch poisons seat 2 (seer)
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('3号');
    expect(info).toContain('4号');
  });

  it('女巫不行动 - 只有被狼杀的玩家死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3
    const room = createTestRoom(['wolf', 'witch', 'seer', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('4号');
    expect(info).not.toContain('平安夜');
  });
});

describe('Room - 守卫 (Guard)', () => {
  it('守卫守护 - 被守护的玩家免于狼杀', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('guard', makeActionTarget(2)); // Guard protects seat 2
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seat 2
    const room = createTestRoom(['wolf', 'guard', 'villager', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });

  it('守卫守护其他人 - 被狼杀的玩家死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('guard', makeActionTarget(3)); // Guard protects seat 3
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seat 2
    const room = createTestRoom(['wolf', 'guard', 'villager', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('3号');
  });

  it('守卫和女巫同守 - 应该奶死（同守必死）', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('guard', makeActionTarget(3)); // Guard protects seat 3
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3
    actions.set('witch', makeActionWitch(makeWitchSave(3))); // Witch saves seat 3
    const room = createTestRoom(['wolf', 'guard', 'witch', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('4号');
    expect(info).toContain('死亡');
  });
});

// NOTE: Seer check tests have been moved to resolver tests
// (src/services/night/resolvers/__tests__/seer.test.ts)

describe('Room - 狼美人 (Wolf Queen)', () => {
  it('狼美人连接后死亡 - 被连接的玩家也死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(1)); // Wolf kills wolf queen (seat 1)
    actions.set('wolfQueen', makeActionTarget(3)); // Wolf queen links seat 3
    const room = createTestRoom(
      ['wolf', 'wolfQueen', 'witch', 'villager', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('2号'); // Wolf queen
    expect(info).toContain('4号'); // Linked player
  });

  it('狼美人没有连接 - 只有狼美人死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(1)); // Wolf kills wolf queen (seat 1)
    const room = createTestRoom(
      ['wolf', 'wolfQueen', 'witch', 'villager', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('2号');
    expect(info).not.toContain('4号');
  });

  it('狼美人存活 - 连接的玩家不会死', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3 (not queen)
    actions.set('wolfQueen', makeActionTarget(2)); // Wolf queen links seat 2
    const room = createTestRoom(
      ['wolf', 'wolfQueen', 'witch', 'villager', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('4号');
    expect(info).not.toContain('3号'); // Linked player survives because queen survived
  });
});

describe('Room - 摄梦人 (Dreamcatcher)', () => {
  it('摄梦人守护 - 被守护的玩家免于死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('dreamcatcher', makeActionTarget(2)); // Dreamcatcher protects seat 2
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seat 2
    const room = createTestRoom(['wolf', 'dreamcatcher', 'villager', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });

  it('摄梦人死亡 - 被守护的玩家也死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('dreamcatcher', makeActionTarget(2)); // Dreamcatcher protects seat 2
    actions.set('wolf', makeActionTarget(1)); // Wolf kills dreamcatcher (seat 1)
    const room = createTestRoom(['wolf', 'dreamcatcher', 'villager', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('2号'); // Dreamcatcher
    expect(info).toContain('3号'); // Protected player dies with dreamcatcher
  });
});

describe('Room - 魔术师 (Magician)', () => {
  it('魔术师交换身份 - 死亡交换', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('magician', makeActionMagicianSwap(2, 3)); // Swap seat 2 and seat 3
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seat 2
    const room = createTestRoom(
      ['wolf', 'magician', 'villager', 'seer', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    // Death should be swapped to seat 3 (player 4)
    expect(info).toContain('4号');
    expect(info).not.toContain('3号');
  });
});

describe('Room - 猎魔人 (Witcher)', () => {
  it('猎魔人免疫女巫毒药', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills seat 3
    actions.set('witch', makeActionWitch(makeWitchPoison(2))); // Witch poisons witcher (seat 2)
    const room = createTestRoom(['wolf', 'witch', 'witcher', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('4号'); // Villager dies
    expect(info).not.toContain('3号'); // Witcher immune to poison
  });
});

describe('Room - 综合场景测试', () => {
  it('复杂场景：守卫守护 + 狼人杀同一人 = 平安夜', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('guard', makeActionTarget(2)); // Guard protects seer (seat 2)
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seer (seat 2)
    const room = createTestRoom(
      ['wolf', 'guard', 'seer', 'witch', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });

  it('复杂场景：狼人杀人 + 女巫毒人 = 两人死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seer (seat 2)
    actions.set('witch', makeActionWitch(makeWitchPoison(4))); // Witch poisons villager (seat 4)
    const room = createTestRoom(
      ['wolf', 'guard', 'seer', 'witch', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('3号');
    expect(info).toContain('5号');
  });

  it('复杂场景：女巫救人 + 摄梦人守护 = 平安夜', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('dreamcatcher', makeActionTarget(4)); // Dreamcatcher protects villager (seat 4)
    actions.set('wolf', makeActionTarget(2)); // Wolf kills seer (seat 2)
    actions.set('witch', makeActionWitch(makeWitchSave(2))); // Witch saves seer (seat 2)
    const room = createTestRoom(
      ['wolf', 'dreamcatcher', 'seer', 'witch', 'villager'],
      actions,
    );

    const info = getLastNightInfo(room);
    expect(info).toContain('平安夜');
  });
});

// NOTE: Psychic check tests have been moved to resolver tests

describe('Room - 黑狼王 (Dark Wolf King)', () => {
  it('黑狼王正常死亡 - wolf action 记录了刀黑狼王', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(1)); // Wolf kills dark wolf king (seat 1)
    const room = createTestRoom(['wolf', 'darkWolfKing', 'seer', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('2号'); // Dark wolf king dies
  });

  it('黑狼王被女巫毒死', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills villager (seat 3)
    actions.set('witch', makeActionWitch(makeWitchPoison(2))); // Witch poisons dark wolf king (seat 2)
    const room = createTestRoom(['wolf', 'witch', 'darkWolfKing', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('3号'); // Dark wolf king dies
    expect(info).toContain('4号'); // Villager dies
  });
});

describe('Room - Spirit Knight (灵骑)', () => {
  it('预言家查验灵骑 - 预言家死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('seer', makeActionTarget(2)); // Seer checks spiritKnight (seat 2)
    const room = createTestRoom(['wolf', 'seer', 'spiritKnight', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).toContain('2号'); // Seer (seat 1) dies — wait, seer is at seat 1
    // Actually seer is at index 1, so "2号"
    expect(info).toContain('死亡');
  });

  it('女巫毒灵骑 - 灵骑免疫毒药，女巫反噬死亡', () => {
    const actions = new Map<RoleId, RoleAction>();
    actions.set('wolf', makeActionTarget(3)); // Wolf kills villager (seat 3)
    actions.set('witch', makeActionWitch(makeWitchPoison(2))); // Witch poisons spiritKnight (seat 2)
    const room = createTestRoom(['wolf', 'witch', 'spiritKnight', 'villager'], actions);

    const info = getLastNightInfo(room);
    expect(info).not.toContain('3号'); // Spirit knight immune
    expect(info).toContain('2号'); // Witch (seat 1) dies by reflection
    expect(info).toContain('4号'); // Villager dies from wolf
  });
});

describe('getPlayersNotViewedRole', () => {
  it('should return all players who have not viewed their role', () => {
    const room = createTestRoom(['wolf', 'seer', 'villager']);

    const notViewed = getPlayersNotViewedRole(room);
    expect(notViewed).toEqual([0, 1, 2]);
  });

  it('should exclude players who have viewed', () => {
    const room = createTestRoom(['wolf', 'seer', 'villager']);
    // Manually mark player at seat 1 as viewed
    const player = room.players.get(1);
    if (player) {
      room.players.set(1, { ...player, hasViewedRole: true });
    }

    const notViewed = getPlayersNotViewedRole(room);
    expect(notViewed).toEqual([0, 2]);
  });

  it('should return empty when all have viewed', () => {
    const room = createTestRoom(['wolf', 'seer']);
    room.players.forEach((player, seat) => {
      if (player) room.players.set(seat, { ...player, hasViewedRole: true });
    });

    const notViewed = getPlayersNotViewedRole(room);
    expect(notViewed).toEqual([]);
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
    const wolfVotes = new Map([[0, 3]]); // wolf at seat 0 voted for seat 3
    const room = createTestRoom(
      ['wolf', 'nightmare', 'gargoyle', 'seer'],
      new Map(),
      wolfVotes,
    );
    // wolf (seat 0) and nightmare (seat 1) participate, gargoyle (seat 2) does not
    const summary = getWolfVoteSummary(room);
    expect(summary).toBe('1/2 狼人已投票');
  });
});

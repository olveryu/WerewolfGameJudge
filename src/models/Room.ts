import { Player, playerFromMap, playerToMap, PlayerStatus, SkillStatus } from './Player';
import { GameTemplate, templateHasSkilledWolf, createTemplateFromRoles } from './Template';
import { RoleName, ROLES, isWolfRole, indexToRole, roleToIndex } from '../constants/roles';

// Room status matching Flutter
export enum RoomStatus {
  seating = 0,
  seated = 1,
  ongoing = 2,
  terminated = 3,
}

// Database keys matching Flutter (for Supabase serialization)
export const ROOM_KEYS = {
  timestamp: 'timestamp',
  hostUid: 'hostUid',
  roomNumber: 'roomNumber',
  roomStatus: 'roomStatus',
  roles: 'roles',
  players: 'players',
  actions: 'actions',
  wolfVotes: 'wolfVotes',
  currentActionerIndex: 'currentActionerIndex',
  hasPoison: 'hasPoison',
  hasAntidote: 'hasAntidote',
} as const;

export interface Room {
  timestamp: number;
  hostUid: string;
  roomNumber: string;
  roomStatus: RoomStatus;
  template: GameTemplate;
  players: Map<number, Player | null>; // seatNumber -> Player
  actions: Map<RoleName, number>; // Role -> target seat
  wolfVotes: Map<number, number>; // Wolf seat -> target seat (for wolf voting)
  currentActionerIndex: number;
  hasPoison: boolean;
  hasAntidote: boolean;
}

// Create a new room
export const createRoom = (
  hostUid: string,
  roomNumber: string,
  template: GameTemplate
): Room => ({
  timestamp: Date.now(),
  hostUid,
  roomNumber,
  roomStatus: RoomStatus.seating,
  template,
  players: new Map(
    Array.from({ length: template.numberOfPlayers }, (_, i) => [i, null])
  ),
  actions: new Map(),
  wolfVotes: new Map(),
  currentActionerIndex: 0,
  hasPoison: true,
  hasAntidote: true,
});

// Convert room to database format
export const roomToDbMap = (room: Room): Record<string, any> => {
  const playersMap: Record<string, any> = {};
  room.players.forEach((player, seat) => {
    playersMap[seat.toString()] = player ? playerToMap(player) : null;
  });

  const actionsMap: Record<string, number> = {};
  room.actions.forEach((target, role) => {
    actionsMap[roleToIndex(role).toString()] = target;
  });

  const wolfVotesMap: Record<string, number> = {};
  room.wolfVotes.forEach((target, wolfSeat) => {
    wolfVotesMap[wolfSeat.toString()] = target;
  });

  return {
    [ROOM_KEYS.timestamp]: room.timestamp,
    [ROOM_KEYS.hostUid]: room.hostUid,
    [ROOM_KEYS.roomStatus]: room.roomStatus,
    [ROOM_KEYS.roles]: room.template.roles.map((r) => roleToIndex(r)),
    [ROOM_KEYS.players]: playersMap,
    [ROOM_KEYS.actions]: actionsMap,
    [ROOM_KEYS.wolfVotes]: wolfVotesMap,
    [ROOM_KEYS.currentActionerIndex]: room.currentActionerIndex,
    [ROOM_KEYS.hasPoison]: room.hasPoison,
    [ROOM_KEYS.hasAntidote]: room.hasAntidote,
  };
};

// Convert database data to Room
export const roomFromDb = (
  roomNumber: string,
  data: Record<string, any>
): Room => {
  const roles = (data[ROOM_KEYS.roles] as number[]).map(
    (i) => indexToRole(i) || 'villager'
  );
  const template = createTemplateFromRoles(roles);

  const players = new Map<number, Player | null>();
  const playersData = data[ROOM_KEYS.players] as Record<string, any>;
  if (playersData) {
    Object.entries(playersData).forEach(([seat, playerData]) => {
      players.set(
        parseInt(seat),
        playerData ? playerFromMap(playerData) : null
      );
    });
  }

  const actions = new Map<RoleName, number>();
  const actionsData = data[ROOM_KEYS.actions] as Record<string, number>;
  if (actionsData) {
    Object.entries(actionsData).forEach(([roleIndex, target]) => {
      const role = indexToRole(parseInt(roleIndex));
      if (role) {
        actions.set(role, target);
      }
    });
  }

  const wolfVotes = new Map<number, number>();
  const wolfVotesData = data[ROOM_KEYS.wolfVotes] as Record<string, number>;
  if (wolfVotesData) {
    Object.entries(wolfVotesData).forEach(([wolfSeat, target]) => {
      wolfVotes.set(parseInt(wolfSeat), target);
    });
  }

  return {
    timestamp: data[ROOM_KEYS.timestamp] ?? Date.now(),
    hostUid: data[ROOM_KEYS.hostUid],
    roomNumber,
    roomStatus: data[ROOM_KEYS.roomStatus] ?? RoomStatus.seating,
    template,
    players,
    actions,
    wolfVotes,
    currentActionerIndex: data[ROOM_KEYS.currentActionerIndex] ?? 0,
    hasPoison: data[ROOM_KEYS.hasPoison] ?? true,
    hasAntidote: data[ROOM_KEYS.hasAntidote] ?? true,
  };
};

// Get current actioner role
export const getCurrentActionRole = (room: Room): RoleName | null => {
  const { currentActionerIndex } = room;
  const actionOrder = room.template.actionOrder;

  if (currentActionerIndex >= actionOrder.length) {
    return null;
  }

  return actionOrder[currentActionerIndex];
};

// Get last actioner role
export const getLastActionRole = (room: Room): RoleName | null => {
  const { currentActionerIndex } = room;
  const actionOrder = room.template.actionOrder;

  if (currentActionerIndex === 0) return null;

  if (currentActionerIndex > actionOrder.length) return null;

  return actionOrder[currentActionerIndex - 1];
};

// Check if template has skilled wolves
export const roomHasSkilledWolf = (room: Room): boolean =>
  templateHasSkilledWolf(room.template);

// Get all wolf seats in the room
export const getAllWolfSeats = (room: Room): number[] => {
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player && isWolfRole(player.role)) {
      wolfSeats.push(seat);
    }
  });
  wolfSeats.sort((a, b) => a - b);
  return wolfSeats;
};

// Get the wolf player index that should act (smallest seat number among all wolves)
export const getActionWolfIndex = (room: Room): number => {
  const wolfSeats = getAllWolfSeats(room);
  return wolfSeats.length > 0 ? wolfSeats[0] : -1;
};

// Record a wolf's vote for kill target
export const recordWolfVote = (
  room: Room,
  wolfSeat: number,
  targetSeat: number
): Room => ({
  ...room,
  wolfVotes: new Map(room.wolfVotes).set(wolfSeat, targetSeat),
});

// Calculate the final wolf kill target based on votes
// Returns -1 (empty kill) if there's a tie
export const calculateWolfKillTarget = (room: Room): number => {
  const wolfSeats = getAllWolfSeats(room);
  
  // Count votes for each target
  const voteCount = new Map<number, number>();
  wolfSeats.forEach((wolfSeat) => {
    const target = room.wolfVotes.get(wolfSeat);
    if (target !== undefined && target !== -1) {
      voteCount.set(target, (voteCount.get(target) ?? 0) + 1);
    }
  });

  if (voteCount.size === 0) {
    return -1; // No votes = empty kill
  }

  // Find the maximum vote count
  let maxVotes = 0;
  voteCount.forEach((count) => {
    if (count > maxVotes) maxVotes = count;
  });

  // Find all targets with maximum votes
  const topTargets: number[] = [];
  voteCount.forEach((count, target) => {
    if (count === maxVotes) topTargets.push(target);
  });

  // If there's a tie, return -1 (empty kill)
  if (topTargets.length > 1) {
    return -1;
  }

  return topTargets[0];
};

// Check if all wolves have voted
export const allWolvesVoted = (room: Room): boolean => {
  const wolfSeats = getAllWolfSeats(room);
  return wolfSeats.every((seat) => room.wolfVotes.has(seat));
};

// Check if a specific wolf has voted
export const hasWolfVoted = (room: Room, seatNumber: number): boolean => {
  return room.wolfVotes.has(seatNumber);
};

// Get wolves who haven't voted yet
export const getWolvesNotVoted = (room: Room): number[] => {
  const wolfSeats = getAllWolfSeats(room);
  return wolfSeats.filter((seat) => !room.wolfVotes.has(seat));
};

// Get wolf vote summary for display
export const getWolfVoteSummary = (room: Room): string => {
  const wolfSeats = getAllWolfSeats(room);
  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已投票`;
};

// Get killed index from wolf action (uses wolfVotes now)
export const getKilledIndex = (room: Room): number => {
  // Check if wolfVotes is populated (new voting system)
  if (room.wolfVotes.size > 0) {
    return calculateWolfKillTarget(room);
  }
  // Fallback to old system for backward compatibility
  return room.actions.get('wolf') ?? -1;
};

// Check hunter status (can shoot or not)
export const getHunterStatus = (room: Room): boolean => {
  const killedByWitch = room.actions.get('witch');
  const linkedByWolfQueen = room.actions.get('wolfQueen');
  const nightmared = room.actions.get('nightmare');

  // Get hunter seat
  let hunterSeat = -1;
  room.players.forEach((player, seat) => {
    if (player && player.role === 'hunter') {
      hunterSeat = seat;
    }
  });

  if (hunterSeat === -1) return true;

  if (killedByWitch !== undefined && killedByWitch < 0 && -killedByWitch - 1 === hunterSeat) {
    return false;
  }
  if (linkedByWolfQueen !== undefined && linkedByWolfQueen === hunterSeat) {
    return false;
  }
  if (nightmared !== undefined && nightmared === hunterSeat) {
    return false;
  }

  return true;
};

// Check dark wolf king status (can use skill if not poisoned by witch)
export const getDarkWolfKingStatus = (room: Room): boolean => {
  const killedByWitch = room.actions.get('witch');

  let darkWolfKingSeat = -1;
  room.players.forEach((player, seat) => {
    if (player && player.role === 'darkWolfKing') {
      darkWolfKingSeat = seat;
    }
  });

  if (darkWolfKingSeat === -1) return true;

  if (killedByWitch !== undefined && killedByWitch < 0 && -killedByWitch - 1 === darkWolfKingSeat) {
    return false;
  }

  return true;
};

// Check if current actioner's skill is blocked by nightmare
export const isCurrentActionerSkillBlocked = (room: Room): boolean => {
  if (!room.template.roles.includes('nightmare')) return false;

  const nightmaredIndex = room.actions.get('nightmare');
  if (nightmaredIndex === undefined) return false;

  const currentRole = getCurrentActionRole(room);
  if (!currentRole) return false;

  const nightmaredPlayer = room.players.get(nightmaredIndex);
  if (!nightmaredPlayer) return false;

  return nightmaredPlayer.role === currentRole;
};

// Calculate last night info (matching Flutter)
export const getLastNightInfo = (room: Room): string => {
  const killedByWolf = room.actions.get('wolf');
  const witchAction = room.actions.get('witch');
  const killedByWitch = witchAction !== undefined && witchAction < 0 ? -witchAction - 1 : null;
  const savedByWitch = witchAction !== undefined && witchAction >= 0 ? witchAction : null;
  const sleptWith = room.actions.get('wolfQueen');
  const guardedByGuard = room.actions.get('guard');
  const nightWalker = room.actions.get('celebrity');
  const magicianAction = room.actions.get('magician');

  let firstExchanged: number | undefined;
  let secondExchanged: number | undefined;
  if (magicianAction !== undefined && magicianAction !== -1) {
    firstExchanged = magicianAction % 100;
    secondExchanged = Math.floor(magicianAction / 100);
  }

  // Find special role seats
  let queenIndex: number | undefined;
  let celebrityIndex: number | undefined;
  let witcherIndex: number | undefined;

  room.players.forEach((player, seat) => {
    if (player) {
      if (player.role === 'wolfQueen') queenIndex = seat;
      if (player.role === 'celebrity') celebrityIndex = seat;
      if (player.role === 'witcher') witcherIndex = seat;
    }
  });

  const deaths = new Set<number>();

  // 奶死 (saved and guarded same person)
  if (savedByWitch !== null && savedByWitch === guardedByGuard) {
    deaths.add(savedByWitch);
  }

  // Killed by wolf (not saved or guarded)
  if (killedByWolf !== undefined && killedByWolf !== -1 && 
      killedByWolf !== guardedByGuard && 
      (savedByWitch === null || savedByWitch !== killedByWolf)) {
    deaths.add(killedByWolf);
  }

  // Poisoned by witch (witcher is immune)
  if (killedByWitch !== null && witcherIndex !== killedByWitch) {
    deaths.add(killedByWitch);
  }

  // Wolf queen dies, linked player dies too
  if (queenIndex !== undefined && deaths.has(queenIndex) && sleptWith !== undefined) {
    deaths.add(sleptWith);
  }

  // Celebrity protects from death
  if (nightWalker !== undefined) {
    deaths.delete(nightWalker);
  }

  // Celebrity dies, dreamer dies too
  if (celebrityIndex !== undefined && deaths.has(celebrityIndex) && nightWalker !== undefined) {
    deaths.add(nightWalker);
  }

  // Magician swap death
  if (firstExchanged !== undefined && secondExchanged !== undefined) {
    if (deaths.has(firstExchanged) && !deaths.has(secondExchanged)) {
      deaths.delete(firstExchanged);
      deaths.add(secondExchanged);
    } else if (!deaths.has(firstExchanged) && deaths.has(secondExchanged)) {
      deaths.delete(secondExchanged);
      deaths.add(firstExchanged);
    }
  }

  let info: string;
  if (deaths.size === 0) {
    info = '昨天晚上是平安夜。';
  } else {
    const sortedDeaths = Array.from(deaths).sort((a, b) => a - b);
    info = `昨天晚上${sortedDeaths.map((d) => `${d + 1}号`).join(', ')}玩家死亡。`;
  }

  return info;
};

// Get room info string
export const getRoomInfo = (room: Room): string => {
  const villagerCount = room.template.roles.filter((r) => r === 'villager').length;
  const wolfCount = room.template.roles.filter((r) => r === 'wolf').length;

  let info = `村民x${villagerCount}, 普狼x${wolfCount}, `;

  const specialRoles = room.template.roles.filter(
    (r) => r !== 'wolf' && r !== 'villager'
  );
  const uniqueSpecialRoles = [...new Set(specialRoles)];

  info += uniqueSpecialRoles.map((r) => ROLES[r].displayName).join(', ');

  return info;
};

// Perform seer action (check player identity)
export const performSeerAction = (room: Room, targetSeat: number): string => {
  const targetPlayer = room.players.get(targetSeat);
  if (!targetPlayer) return '好人';

  // Check magician swap
  const magicianAction = room.actions.get('magician');
  if (magicianAction !== undefined && magicianAction !== -1) {
    const first = magicianAction % 100;
    const second = Math.floor(magicianAction / 100);

    if (targetSeat === first) {
      const swappedPlayer = room.players.get(second);
      return swappedPlayer && isWolfRole(swappedPlayer.role) ? '狼人' : '好人';
    } else if (targetSeat === second) {
      const swappedPlayer = room.players.get(first);
      return swappedPlayer && isWolfRole(swappedPlayer.role) ? '狼人' : '好人';
    }
  }

  return isWolfRole(targetPlayer.role) ? '狼人' : '好人';
};

// Perform psychic action (check exact role)
export const performPsychicAction = (room: Room, targetSeat: number): string => {
  // Check if wolf robot learned this player's role
  const wolfRobotAction = room.actions.get('wolfRobot');
  let wolfRobotSeat = -1;
  room.players.forEach((player, seat) => {
    if (player && player.role === 'wolfRobot') {
      wolfRobotSeat = seat;
    }
  });

  if (wolfRobotSeat === targetSeat && wolfRobotAction !== undefined) {
    const learnedPlayer = room.players.get(wolfRobotAction);
    return learnedPlayer ? ROLES[learnedPlayer.role].displayName : '未知';
  }

  const targetPlayer = room.players.get(targetSeat);
  return targetPlayer ? ROLES[targetPlayer.role].displayName : '未知';
};

// Proceed to next action (matching Flutter room.proceed)
export const proceedToNextAction = (
  room: Room,
  targetIndex: number | null,
  extra?: any
): Room => {
  const currentRole = getCurrentActionRole(room);
  
  if (!currentRole) return room;

  const newActions = new Map(room.actions);
  
  // Record action
  if (targetIndex !== null) {
    if (currentRole === 'witch') {
      // Witch can save (positive) or poison (negative - 1)
      if (extra === false) {
        // Save action
        newActions.set(currentRole, targetIndex);
      } else {
        // Poison action (negative encoding)
        newActions.set(currentRole, -(targetIndex + 1));
      }
    } else {
      newActions.set(currentRole, targetIndex);
    }
  }

  return {
    ...room,
    actions: newActions,
    currentActionerIndex: room.currentActionerIndex + 1,
  };
};

// Start the game (matching Flutter room.startGame)
export const startGame = (room: Room): Room => ({
  ...room,
  roomStatus: RoomStatus.ongoing,
  currentActionerIndex: 0,
  actions: new Map(),
  wolfVotes: new Map(),
  hasPoison: true,
  hasAntidote: true,
});

// Restart the game with same template (matching Flutter room.restart)
// 重新开始：回到seating状态，玩家保留但需要重新入座确认，角色重新洗牌
export const restartRoom = (room: Room): Room => {
  const shuffledRoles = shuffleArray([...room.template.roles]);
  
  // Keep players but update their roles based on new shuffle
  const updatedPlayers = new Map<number, Player>();
  room.players.forEach((player, seatNumber) => {
    if (!player) return;
    const updatedPlayer: Player = {
      uid: player.uid,
      seatNumber: player.seatNumber,
      displayName: player.displayName,
      role: shuffledRoles[seatNumber],
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
    };
    updatedPlayers.set(seatNumber, updatedPlayer);
  });
  
  return {
    ...room,
    roomStatus: RoomStatus.seating, // 回到入座状态，玩家需要重新点击确认
    currentActionerIndex: 0,
    actions: new Map(),
    wolfVotes: new Map(),
    hasPoison: true,
    hasAntidote: true,
    players: updatedPlayers,
    template: {
      ...room.template,
      roles: shuffledRoles,
    },
  };
};

// Helper to shuffle array
const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

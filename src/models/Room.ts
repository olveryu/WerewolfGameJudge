import { Player, playerFromMap, playerToMap, PlayerStatus, SkillStatus } from './Player';
import { GameTemplate, templateHasSkilledWolf, createTemplateFromRoles } from './Template';
import { RoleName, ROLES, isWolfRole } from './roles';
import { NightPhase } from './NightPhase';

// Room status
export enum RoomStatus {
  unseated = 0,  // 等待入座
  seated = 1,    // 所有人入座，等待准备看牌
  assigned = 2,  // 角色已分配，等待所有人查看身份
  ready = 3,     // 所有人已看身份，可以开始游戏
  ongoing = 4,   // 游戏进行中
}

// =============================================================================
// Common interface for Room-like objects (supports both Room and LocalGameState)
// =============================================================================
export interface GameRoomLike {
  template: GameTemplate;
  players: Map<number, { uid: string; seatNumber: number; role: RoleName | null; hasViewedRole: boolean; displayName?: string; avatarUrl?: string | null } | null>;
  actions: Map<RoleName, number>;
  wolfVotes: Map<number, number>;
  currentActionerIndex: number;
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
  isAudioPlaying: 'isAudioPlaying',
  nightPhase: 'nightPhase',  // V2: Server-driven night phase state
} as const;

export interface Room {
  timestamp: number;
  hostUid: string;
  roomNumber: string;
  roomStatus: RoomStatus;
  template: GameTemplate;
  players: Map<number, Player | null>; // seatNumber -> Player
  actions: Map<RoleName, number>; // Role -> target seat (negative for witch poison: -target-1)
  wolfVotes: Map<number, number>; // Wolf seat -> target seat (for wolf voting)
  currentActionerIndex: number;
  isAudioPlaying: boolean; // Whether host is playing audio for current action
  nightPhase?: NightPhase | null; // V2: Optional server-driven night phase state (for future use)
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
  roomStatus: RoomStatus.unseated,
  template,
  players: new Map(
    Array.from({ length: template.numberOfPlayers }, (_, i) => [i, null])
  ),
  actions: new Map(),
  wolfVotes: new Map(),
  currentActionerIndex: 0,
  isAudioPlaying: false,
});

// Convert room to database format
export const roomToDbMap = (room: Room): Record<string, any> => {
  const playersMap: Record<string, any> = {};
  room.players.forEach((player, seat) => {
    playersMap[seat.toString()] = player ? playerToMap(player) : null;
  });

  const actionsMap: Record<string, number> = {};
  room.actions.forEach((target, role) => {
    actionsMap[role] = target;  // Use role name as key directly
  });

  const wolfVotesMap: Record<string, number> = {};
  room.wolfVotes.forEach((target, wolfSeat) => {
    wolfVotesMap[wolfSeat.toString()] = target;
  });

  return {
    [ROOM_KEYS.timestamp]: room.timestamp,
    [ROOM_KEYS.hostUid]: room.hostUid,
    [ROOM_KEYS.roomStatus]: room.roomStatus,
    [ROOM_KEYS.roles]: room.template.roles,  // Store role names directly
    [ROOM_KEYS.players]: playersMap,
    [ROOM_KEYS.actions]: actionsMap,
    [ROOM_KEYS.wolfVotes]: wolfVotesMap,
    [ROOM_KEYS.currentActionerIndex]: room.currentActionerIndex,
    [ROOM_KEYS.isAudioPlaying]: room.isAudioPlaying,
  };
};

// Convert database data to Room
export const roomFromDb = (
  roomNumber: string,
  data: Record<string, any>
): Room => {
  const roles = data[ROOM_KEYS.roles] as RoleName[];
  const template = createTemplateFromRoles(roles);

  const players = new Map<number, Player | null>();
  const playersData = data[ROOM_KEYS.players] as Record<string, any>;
  if (playersData) {
    Object.entries(playersData).forEach(([seat, playerData]) => {
      players.set(
        Number.parseInt(seat),
        playerData ? playerFromMap(playerData) : null
      );
    });
  }

  const actions = new Map<RoleName, number>();
  const actionsData = data[ROOM_KEYS.actions] as Record<string, number>;
  if (actionsData) {
    Object.entries(actionsData).forEach(([roleName, target]) => {
      actions.set(roleName as RoleName, target);
    });
  }

  const wolfVotes = new Map<number, number>();
  const wolfVotesData = data[ROOM_KEYS.wolfVotes] as Record<string, number>;
  if (wolfVotesData) {
    Object.entries(wolfVotesData).forEach(([wolfSeat, target]) => {
      wolfVotes.set(Number.parseInt(wolfSeat), target);
    });
  }

  return {
    timestamp: data[ROOM_KEYS.timestamp] ?? Date.now(),
    hostUid: data[ROOM_KEYS.hostUid],
    roomNumber,
    roomStatus: data[ROOM_KEYS.roomStatus] ?? RoomStatus.unseated,
    template,
    players,
    actions,
    wolfVotes,
    currentActionerIndex: data[ROOM_KEYS.currentActionerIndex] ?? 0,
    isAudioPlaying: data[ROOM_KEYS.isAudioPlaying] ?? false,
  };
};

// Get current actioner role
export const getCurrentActionRole = (room: GameRoomLike): RoleName | null => {
  const { currentActionerIndex } = room;
  const actionOrder = room.template.actionOrder;

  if (currentActionerIndex >= actionOrder.length) {
    return null;
  }

  return actionOrder[currentActionerIndex];
};

// Get last actioner role
export const getLastActionRole = (room: GameRoomLike): RoleName | null => {
  const { currentActionerIndex } = room;
  const actionOrder = room.template.actionOrder;

  if (currentActionerIndex === 0) return null;

  if (currentActionerIndex > actionOrder.length) return null;

  return actionOrder[currentActionerIndex - 1];
};

// Check if template has skilled wolves
export const roomHasSkilledWolf = (room: GameRoomLike): boolean =>
  templateHasSkilledWolf(room.template);

// Get all wolf seats in the room
export const getAllWolfSeats = (room: GameRoomLike): number[] => {
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player?.role && isWolfRole(player.role)) {
      wolfSeats.push(seat);
    }
  });
  wolfSeats.sort((a, b) => a - b);
  return wolfSeats;
};

// Get the wolf player index that should act (smallest seat number among all wolves)
export const getActionWolfIndex = (room: GameRoomLike): number => {
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
export const calculateWolfKillTarget = (room: GameRoomLike): number => {
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
export const allWolvesVoted = (room: GameRoomLike): boolean => {
  const wolfSeats = getAllWolfSeats(room);
  return wolfSeats.every((seat) => room.wolfVotes.has(seat));
};

// Check if a specific wolf has voted
export const hasWolfVoted = (room: GameRoomLike, seatNumber: number): boolean => {
  return room.wolfVotes.has(seatNumber);
};

// Get wolves who haven't voted yet
export const getWolvesNotVoted = (room: GameRoomLike): number[] => {
  const wolfSeats = getAllWolfSeats(room);
  return wolfSeats.filter((seat) => !room.wolfVotes.has(seat));
};

// Get wolf vote summary for display
export const getWolfVoteSummary = (room: GameRoomLike): string => {
  const wolfSeats = getAllWolfSeats(room);
  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已投票`;
};

// Get killed index from wolf action
// Priority: actions['wolf'] (set by RPC) > calculate from wolfVotes (legacy)
export const getKilledIndex = (room: GameRoomLike): number => {
  // Prefer actions['wolf'] - this is set atomically by the RPC when all wolves vote
  const actionResult = room.actions.get('wolf');
  if (actionResult !== undefined) {
    return actionResult;
  }
  // Fallback: calculate from wolfVotes (for backward compatibility)
  if (room.wolfVotes.size > 0) {
    return calculateWolfKillTarget(room);
  }
  return -1;
};

// Check hunter status (can shoot or not)
export const getHunterStatus = (room: GameRoomLike): boolean => {
  const killedByWitch = room.actions.get('witch');
  const linkedByWolfQueen = room.actions.get('wolfQueen');
  const nightmared = room.actions.get('nightmare');

  // Get hunter seat
  let hunterSeat = -1;
  room.players.forEach((player, seat) => {
    if (player?.role === 'hunter') {
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
export const getDarkWolfKingStatus = (room: GameRoomLike): boolean => {
  const killedByWitch = room.actions.get('witch');

  let darkWolfKingSeat = -1;
  room.players.forEach((player, seat) => {
    if (player?.role === 'darkWolfKing') {
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
export const isCurrentActionerSkillBlocked = (room: GameRoomLike): boolean => {
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
// Parse witch action into killed/saved
function parseWitchAction(witchAction: number | undefined): { killedByWitch: number | null; savedByWitch: number | null } {
  if (witchAction === undefined) {
    return { killedByWitch: null, savedByWitch: null };
  }
  if (witchAction < 0) {
    return { killedByWitch: -witchAction - 1, savedByWitch: null };
  }
  return { killedByWitch: null, savedByWitch: witchAction };
}

// Parse magician action into exchanged seats
function parseMagicianAction(magicianAction: number | undefined): { firstExchanged?: number; secondExchanged?: number } {
  if (magicianAction === undefined || magicianAction === -1) {
    return {};
  }
  return {
    firstExchanged: magicianAction % 100,
    secondExchanged: Math.floor(magicianAction / 100)
  };
}

// Find special role seats (works with GameRoomLike)
function findSpecialRoleSeats(room: GameRoomLike): { queenIndex?: number; celebrityIndex?: number; witcherIndex?: number } {
  let queenIndex: number | undefined;
  let celebrityIndex: number | undefined;
  let witcherIndex: number | undefined;

  room.players.forEach((player, seat) => {
    if (player?.role === 'wolfQueen') queenIndex = seat;
    if (player?.role === 'celebrity') celebrityIndex = seat;
    if (player?.role === 'witcher') witcherIndex = seat;
  });

  return { queenIndex, celebrityIndex, witcherIndex };
}

// Apply magician swap to deaths
function applyMagicianSwap(deaths: Set<number>, firstExchanged?: number, secondExchanged?: number): void {
  if (firstExchanged === undefined || secondExchanged === undefined) return;
  
  const firstDead = deaths.has(firstExchanged);
  const secondDead = deaths.has(secondExchanged);
  
  if (firstDead && !secondDead) {
    deaths.delete(firstExchanged);
    deaths.add(secondExchanged);
  } else if (!firstDead && secondDead) {
    deaths.delete(secondExchanged);
    deaths.add(firstExchanged);
  }
}

export const getLastNightInfo = (room: GameRoomLike): string => {
  const killedByWolf = room.actions.get('wolf');
  const witchAction = room.actions.get('witch');
  const { killedByWitch, savedByWitch } = parseWitchAction(witchAction);
  const sleptWith = room.actions.get('wolfQueen');
  const guardedByGuard = room.actions.get('guard');
  const nightWalker = room.actions.get('celebrity');
  const { firstExchanged, secondExchanged } = parseMagicianAction(room.actions.get('magician'));
  const { queenIndex, celebrityIndex, witcherIndex } = findSpecialRoleSeats(room);

  const deaths = new Set<number>();

  // 奶死 (saved and guarded same person)
  if (savedByWitch !== null && savedByWitch === guardedByGuard) {
    deaths.add(savedByWitch);
  }

  // Killed by wolf (not saved or guarded)
  const wolfKillValid = killedByWolf !== undefined && killedByWolf !== -1 && killedByWolf !== guardedByGuard;
  const notSaved = savedByWitch === null || savedByWitch !== killedByWolf;
  if (wolfKillValid && notSaved) {
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
  applyMagicianSwap(deaths, firstExchanged, secondExchanged);

  if (deaths.size === 0) {
    return '昨天晚上是平安夜。';
  }
  
  const sortedDeaths = Array.from(deaths).sort((a, b) => a - b);
  const deathNumbers = sortedDeaths.map((d) => `${d + 1}号`).join(', ');
  return `昨天晚上${deathNumbers}玩家死亡。`;
};

// Get action log for all completed actions in the current night
export const getActionLog = (room: GameRoomLike): string[] => {
  const logs: string[] = [];
  
  // Go through action order to show completed actions
  for (let i = 0; i < room.currentActionerIndex; i++) {
    const roleName = room.template.actionOrder[i];
    if (!roleName) continue;
    
    const roleInfo = ROLES[roleName];
    if (!roleInfo) continue;
    
    const actionValue = room.actions.get(roleName);
    const displayName = roleInfo.displayName;
    const actionVerb = roleInfo.actionConfirmMessage || '选择';
    
    // Special handling for roles with specific action formats
    if (roleName === 'wolf') {
      if (actionValue === undefined || actionValue === -1) {
        logs.push(`${displayName}: 空刀`);
      } else {
        logs.push(`${displayName}: 猎杀 ${actionValue + 1}号`);
      }
    } else if (roleName === 'witch') {
      const { killedByWitch, savedByWitch } = parseWitchAction(actionValue);
      if (savedByWitch !== null) {
        logs.push(`${displayName}: 救了 ${savedByWitch + 1}号`);
      } else if (killedByWitch !== null) {
        logs.push(`${displayName}: 毒了 ${killedByWitch + 1}号`);
      } else {
        logs.push(`${displayName}: 未使用技能`);
      }
    } else if (roleName === 'magician') {
      if (actionValue === undefined || actionValue === null) {
        logs.push(`${displayName}: 未${actionVerb}`);
      } else {
        const first = actionValue % 100;
        const second = Math.floor(actionValue / 100);
        logs.push(`${displayName}: ${actionVerb} ${first + 1}号 和 ${second + 1}号`);
      }
    } else if (roleName === 'hunter' || roleName === 'darkWolfKing') {
      // Status confirmation roles - just show they confirmed
      logs.push(`${displayName}: ${actionVerb}`);
    } else if (actionValue === undefined || actionValue === null || actionValue === -1) {
      // Generic handling - no target selected
      logs.push(`${displayName}: 未${actionVerb}`);
    } else {
      // Generic handling - target selected (seer, slacker, guard, etc.)
      logs.push(`${displayName}: ${actionVerb} ${actionValue + 1}号`);
    }
  }
  
  return logs;
};

// Get room info string
export const getRoomInfo = (room: GameRoomLike): string => {
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
export const performSeerAction = (room: GameRoomLike, targetSeat: number): string => {
  const targetPlayer = room.players.get(targetSeat);
  if (!targetPlayer) return '好人';

  // Check magician swap
  const magicianAction = room.actions.get('magician');
  if (magicianAction !== undefined && magicianAction !== -1) {
    const first = magicianAction % 100;
    const second = Math.floor(magicianAction / 100);

    if (targetSeat === first) {
      const swappedPlayer = room.players.get(second);
      return swappedPlayer?.role && isWolfRole(swappedPlayer.role) ? '狼人' : '好人';
    } else if (targetSeat === second) {
      const swappedPlayer = room.players.get(first);
      return swappedPlayer?.role && isWolfRole(swappedPlayer.role) ? '狼人' : '好人';
    }
  }

  return targetPlayer.role && isWolfRole(targetPlayer.role) ? '狼人' : '好人';
};

// Perform psychic action (check exact role)
export const performPsychicAction = (room: GameRoomLike, targetSeat: number): string => {
  // Check if wolf robot learned this player's role
  const wolfRobotAction = room.actions.get('wolfRobot');
  let wolfRobotSeat = -1;
  room.players.forEach((player, seat) => {
    if (player?.role === 'wolfRobot') {
      wolfRobotSeat = seat;
    }
  });

  if (wolfRobotSeat === targetSeat && wolfRobotAction !== undefined) {
    const learnedPlayer = room.players.get(wolfRobotAction);
    return learnedPlayer?.role ? ROLES[learnedPlayer.role].displayName : '未知';
  }

  const targetPlayer = room.players.get(targetSeat);
  return targetPlayer?.role ? ROLES[targetPlayer.role].displayName : '未知';
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
  isAudioPlaying: true, // Audio will start playing immediately
});

// Assign roles to all seated players (called when host clicks "准备看牌")
// Shuffles roles and assigns them to players, then changes status to seated
export const assignRoles = (room: Room): Room => {
  const shuffledRoles = shuffleArray([...room.template.roles]);
  
  // Assign shuffled roles to all seated players
  const updatedPlayers = new Map<number, Player | null>();
  room.players.forEach((player, seatNumber) => {
    if (!player) {
      updatedPlayers.set(seatNumber, null);
      return;
    }
    const updatedPlayer: Player = {
      ...player,
      role: shuffledRoles[seatNumber],
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,  // 重置查看状态
    };
    updatedPlayers.set(seatNumber, updatedPlayer);
  });
  
  return {
    ...room,
    roomStatus: RoomStatus.assigned,  // 角色已分配
    players: updatedPlayers,
    template: {
      ...room.template,
      roles: shuffledRoles,  // Store shuffled roles in template
    },
  };
};

// Restart the game with same template (matching Flutter room.restart)
// 重新开始：回到seated状态，玩家保留座位但角色清空，等待host再次点击"准备看牌"
export const restartRoom = (room: Room): Room => {
  // Keep players but clear their roles
  const updatedPlayers = new Map<number, Player | null>();
  room.players.forEach((player, seatNumber) => {
    if (!player) {
      updatedPlayers.set(seatNumber, null);
      return;
    }
    const updatedPlayer: Player = {
      ...player,
      role: null,  // Clear role, will be reassigned when host clicks "准备看牌"
      status: PlayerStatus.alive,
      skillStatus: SkillStatus.available,
      hasViewedRole: false,  // 重置查看状态
    };
    updatedPlayers.set(seatNumber, updatedPlayer);
  });
  
  return {
    ...room,
    roomStatus: RoomStatus.seated, // 回到已入座状态，等待host点击"准备看牌"
    currentActionerIndex: 0,
    actions: new Map(),
    wolfVotes: new Map(),
    isAudioPlaying: false,
    players: updatedPlayers,
  };
};

// Mark a player as having viewed their role
// Automatically changes status to 'ready' when all players have viewed
// This function is IDEMPOTENT - calling it multiple times has no effect
export const markPlayerViewedRole = (room: Room, seatNumber: number): Room => {
  const player = room.players.get(seatNumber);
  
  // Idempotent: return unchanged room if player doesn't exist or already viewed
  if (!player || player.hasViewedRole) {
    return room;
  }
  
  const updatedPlayers = new Map(room.players);
  updatedPlayers.set(seatNumber, {
    ...player,
    hasViewedRole: true,
  });
  
  // Check if all players have now viewed their roles
  let allViewed = true;
  updatedPlayers.forEach((p) => {
    if (p && !p.hasViewedRole) {
      allViewed = false;
    }
  });
  
  return {
    ...room,
    roomStatus: allViewed ? RoomStatus.ready : room.roomStatus,
    players: updatedPlayers,
  };
};

// Get list of players who haven't viewed their role
export const getPlayersNotViewedRole = (room: GameRoomLike): number[] => {
  const notViewed: number[] = [];
  room.players.forEach((player, seat) => {
    if (player && !player.hasViewedRole) {
      notViewed.push(seat);
    }
  });
  return notViewed.sort((a, b) => a - b);
};

// Check if all players have viewed their roles
export const allPlayersViewedRoles = (room: GameRoomLike): boolean => {
  return getPlayersNotViewedRole(room).length === 0;
};

// Update room template with new roles
// - If template unchanged: no changes
// - If template changed: adjust player seats and reset game state
//   - Same player count: keep players seated (status = seated)
//   - Adding roles: add empty seats at the end (status = unseated, need new players)
//   - Removing roles: remove seats from the end (status = seated if all kept seats have players)
export const updateRoomTemplate = (room: Room, newTemplate: GameTemplate): Room => {
  const oldPlayerCount = room.template.numberOfPlayers;
  const newPlayerCount = newTemplate.numberOfPlayers;
  
  // Check if template actually changed (compare roles)
  const oldRoles = [...room.template.roles].sort((a, b) => a.localeCompare(b));
  const newRoles = [...newTemplate.roles].sort((a, b) => a.localeCompare(b));
  const rolesChanged = JSON.stringify(oldRoles) !== JSON.stringify(newRoles);
  
  if (!rolesChanged) {
    // No changes, return room as-is
    return room;
  }
  
  // Template changed - adjust players
  const updatedPlayers = new Map<number, Player | null>();
  
  // Keep existing players (without roles), adjust seat count
  const seatsToKeep = Math.min(oldPlayerCount, newPlayerCount);
  
  for (let i = 0; i < seatsToKeep; i++) {
    const player = room.players.get(i);
    if (player) {
      // Keep player but clear role info
      updatedPlayers.set(i, {
        ...player,
        role: null,
        status: PlayerStatus.alive,
        skillStatus: SkillStatus.available,
        hasViewedRole: false,
      });
    } else {
      updatedPlayers.set(i, null);
    }
  }
  
  // Add new empty seats if increasing
  for (let i = oldPlayerCount; i < newPlayerCount; i++) {
    updatedPlayers.set(i, null);
  }
  // Players at seats >= newPlayerCount are removed (become unseated)
  
  // Determine new room status:
  // - If all seats have players: seated
  // - If any seat is empty: unseated
  const allSeated = Array.from(updatedPlayers.values()).every(p => p !== null);
  
  return {
    ...room,
    roomStatus: allSeated ? RoomStatus.seated : RoomStatus.unseated,
    currentActionerIndex: 0,
    actions: new Map(),
    wolfVotes: new Map(),
    isAudioPlaying: false,
    players: updatedPlayers,
    template: newTemplate,
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

// Night result interface
export interface NightResult {
  killedByWolf: number | null;       // 被狼人杀的玩家座位
  savedByWitch: boolean;              // 女巫是否使用解药
  poisonedPlayer: number | null;      // 被女巫毒的玩家座位
  protectedBySeer: number | null;     // 被预言家查验的玩家座位（仅记录）
  deadPlayers: number[];              // 当晚死亡的玩家列表
}

// Calculate night result based on actions
export const getNightResult = (room: GameRoomLike): NightResult => {
  const wolfAction = room.actions.get('wolf') ?? null;
  const witchAction = room.actions.get('witch') ?? null;
  const seerAction = room.actions.get('seer') ?? null;
  const guardAction = room.actions.get('guard') ?? null;
  
  const killedByWolf = wolfAction;
  
  // proceedToNextAction encoding:
  // - Save: stores targetIndex (positive/zero)
  // - Poison: stores -(targetIndex + 1) (negative)
  // So positive/zero = save, negative = poison
  const savedByWitch = witchAction !== null && witchAction >= 0;
  const poisonedPlayer = (witchAction !== null && witchAction < 0) ? -(witchAction + 1) : null;
  
  // 检查守卫是否守护了被杀的人
  const protectedByGuard = killedByWolf !== null && killedByWolf === guardAction;
  
  // 计算死亡玩家
  const deadPlayers: number[] = [];
  
  if (killedByWolf !== null) {
    // 同守必死：女巫救 + 守卫守同一个人 = 死亡
    const doubleProtection = savedByWitch && protectedByGuard && killedByWolf === witchAction;
    // 存活条件：只有女巫救或只有守卫守（不是同时）
    const survived = (savedByWitch || protectedByGuard) && !doubleProtection;
    
    if (!survived) {
      deadPlayers.push(killedByWolf);
    }
  }
  
  // 被女巫毒
  if (poisonedPlayer !== null) {
    if (!deadPlayers.includes(poisonedPlayer)) {
      deadPlayers.push(poisonedPlayer);
    }
  }
  
  return {
    killedByWolf,
    savedByWitch,
    poisonedPlayer,
    protectedBySeer: seerAction,
    deadPlayers,
  };
};

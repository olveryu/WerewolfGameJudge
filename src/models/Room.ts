/**
 * Room - 房间/游戏状态数据模型
 *
 * 定义 GameRoomLike / Room 等核心接口和纯函数工具
 * （calculateDeaths / formatActionSummary 等）。
 *
 * ✅ 允许：类型定义、纯函数查询/计算
 * ❌ 禁止：import service / 副作用 / IO
 */
import { GameTemplate } from './Template';
import { RoleId, doesRoleParticipateInWolfVote } from './roles';
import {
  type RoleAction,
  isActionWitch,
  isActionMagicianSwap,
  getActionTargetSeat,
  isWitchSave,
  isWitchPoison,
} from './actions';

// Re-export GameStatus for consumers who import from Room
export { GameStatus } from './GameStatus';

// =============================================================================
// Common interface for Room-like objects (supports both Room and LocalGameState)
// =============================================================================
export interface GameRoomLike {
  template: GameTemplate;
  players: Map<
    number,
    {
      uid: string;
      seatNumber: number;
      role: RoleId | null;
      hasViewedRole: boolean;
      displayName?: string;
      avatarUrl?: string | null;
    } | null
  >;
  actions: Map<RoleId, RoleAction>;
  wolfVotes: Map<number, number>;
  currentStepIndex: number;
}

// Check if a specific wolf has voted
export const hasWolfVoted = (room: GameRoomLike, seatNumber: number): boolean => {
  return room.wolfVotes.has(seatNumber);
};

// Get wolf vote summary for display
export const getWolfVoteSummary = (room: GameRoomLike): string => {
  // Inline: get wolf seats that participate in wolf vote
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
      wolfSeats.push(seat);
    }
  });
  wolfSeats.sort((a, b) => a - b);

  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已投票`;
};

// Calculate last night info (matching Flutter)
// Parse witch action into killed/saved (from structured RoleAction)
function parseWitchActionFromRoleAction(action: RoleAction | undefined): {
  killedByWitch: number | null;
  savedByWitch: number | null;
} {
  if (!action || !isActionWitch(action)) {
    return { killedByWitch: null, savedByWitch: null };
  }
  const wa = action.witchAction;
  if (isWitchPoison(wa)) {
    return { killedByWitch: wa.targetSeat, savedByWitch: null };
  }
  if (isWitchSave(wa)) {
    return { killedByWitch: null, savedByWitch: wa.targetSeat };
  }
  return { killedByWitch: null, savedByWitch: null };
}

// Parse magician action into exchanged seats (from structured RoleAction)
function parseMagicianActionFromRoleAction(action: RoleAction | undefined): {
  firstSwapSeat?: number;
  secondSwapSeat?: number;
} {
  if (!action || !isActionMagicianSwap(action)) {
    return {};
  }
  return {
    firstSwapSeat: action.firstSeat,
    secondSwapSeat: action.secondSeat,
  };
}

// Find special role seats (works with GameRoomLike)
function findSpecialRoleSeats(room: GameRoomLike): {
  queenSeat?: number;
  dreamcatcherSeat?: number;
  witcherSeat?: number;
  spiritKnightSeat?: number;
  seerSeat?: number;
  witchSeat?: number;
} {
  let queenSeat: number | undefined;
  let dreamcatcherSeat: number | undefined;
  let witcherSeat: number | undefined;
  let spiritKnightSeat: number | undefined;
  let seerSeat: number | undefined;
  let witchSeat: number | undefined;

  room.players.forEach((player, seat) => {
    if (player?.role === 'wolfQueen') queenSeat = seat;
    if (player?.role === 'dreamcatcher') dreamcatcherSeat = seat;
    if (player?.role === 'witcher') witcherSeat = seat;
    if (player?.role === 'spiritKnight') spiritKnightSeat = seat;
    if (player?.role === 'seer') seerSeat = seat;
    if (player?.role === 'witch') witchSeat = seat;
  });

  return { queenSeat, dreamcatcherSeat, witcherSeat, spiritKnightSeat, seerSeat, witchSeat };
}

// Apply magician swap to deaths
function applyMagicianSwap(
  deaths: Set<number>,
  firstSwapSeat?: number,
  secondSwapSeat?: number,
): void {
  if (firstSwapSeat === undefined || secondSwapSeat === undefined) return;

  const firstDead = deaths.has(firstSwapSeat);
  const secondDead = deaths.has(secondSwapSeat);

  if (firstDead && !secondDead) {
    deaths.delete(firstSwapSeat);
    deaths.add(secondSwapSeat);
  } else if (!firstDead && secondDead) {
    deaths.delete(secondSwapSeat);
    deaths.add(firstSwapSeat);
  }
}

export const getLastNightInfo = (room: GameRoomLike): string => {
  // Extract targets from structured actions
  const wolfKillSeat = getActionTargetSeat(room.actions.get('wolf'));
  const witchAction = room.actions.get('witch');
  const { killedByWitch, savedByWitch } = parseWitchActionFromRoleAction(witchAction);
  const charmTargetSeat = getActionTargetSeat(room.actions.get('wolfQueen'));
  const guardProtectSeat = getActionTargetSeat(room.actions.get('guard'));
  const dreamcatcherTargetSeat = getActionTargetSeat(room.actions.get('dreamcatcher'));
  const seerCheckedSeat = getActionTargetSeat(room.actions.get('seer'));
  const { firstSwapSeat, secondSwapSeat } = parseMagicianActionFromRoleAction(
    room.actions.get('magician'),
  );
  const { queenSeat, dreamcatcherSeat, witcherSeat, spiritKnightSeat, seerSeat, witchSeat } =
    findSpecialRoleSeats(room);

  const deaths = new Set<number>();

  // 奶死 (saved and guarded same person)
  if (
    savedByWitch !== null &&
    guardProtectSeat !== undefined &&
    savedByWitch === guardProtectSeat
  ) {
    deaths.add(savedByWitch);
  }

  // Killed by wolf (not saved or guarded)
  const wolfKillValid = wolfKillSeat !== undefined && wolfKillSeat !== guardProtectSeat;
  const notSaved = savedByWitch === null || savedByWitch !== wolfKillSeat;
  if (wolfKillValid && notSaved) {
    deaths.add(wolfKillSeat);
  }

  // Poisoned by witch (witcher is immune)
  if (killedByWitch !== null && witcherSeat !== killedByWitch) {
    deaths.add(killedByWitch);
  }

  // Spirit Knight reflect rules:
  // - If seer checks spiritKnight, seer dies (next day). We model it as a death in last night info.
  // - If witch poisons spiritKnight, witch dies (next day) and poison is ineffective.
  if (spiritKnightSeat !== undefined) {
    if (
      seerCheckedSeat !== undefined &&
      seerCheckedSeat === spiritKnightSeat &&
      seerSeat !== undefined
    ) {
      deaths.add(seerSeat);
    }

    if (killedByWitch !== null && killedByWitch === spiritKnightSeat) {
      // Poison has no effect on spirit knight
      deaths.delete(spiritKnightSeat);

      // Witch dies by reflection
      if (witchSeat !== undefined) {
        deaths.add(witchSeat);
      }
    }
  }

  // Wolf queen dies, linked player dies too
  if (queenSeat !== undefined && deaths.has(queenSeat) && charmTargetSeat !== undefined) {
    deaths.add(charmTargetSeat);
  }

  // Dreamcatcher protects dream target from death
  if (dreamcatcherTargetSeat !== undefined) {
    deaths.delete(dreamcatcherTargetSeat);
  }

  // Dreamcatcher dies, dreamer dies too
  if (
    dreamcatcherSeat !== undefined &&
    deaths.has(dreamcatcherSeat) &&
    dreamcatcherTargetSeat !== undefined
  ) {
    deaths.add(dreamcatcherTargetSeat);
  }

  // Magician swap death
  applyMagicianSwap(deaths, firstSwapSeat, secondSwapSeat);

  if (deaths.size === 0) {
    return '昨天晚上是平安夜。';
  }

  const sortedDeaths = Array.from(deaths).sort((a, b) => a - b);
  const deathNumbers = sortedDeaths.map((d) => `${d + 1}号`).join(', ');
  return `昨天晚上${deathNumbers}玩家死亡。`;
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



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
  currentActionerIndex: number;
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
  firstExchanged?: number;
  secondExchanged?: number;
} {
  if (!action || !isActionMagicianSwap(action)) {
    return {};
  }
  return {
    firstExchanged: action.firstSeat,
    secondExchanged: action.secondSeat,
  };
}

// Find special role seats (works with GameRoomLike)
function findSpecialRoleSeats(room: GameRoomLike): {
  queenIndex?: number;
  dreamcatcherIndex?: number;
  witcherIndex?: number;
  spiritKnightIndex?: number;
  seerIndex?: number;
  witchIndex?: number;
} {
  let queenIndex: number | undefined;
  let dreamcatcherIndex: number | undefined;
  let witcherIndex: number | undefined;
  let spiritKnightIndex: number | undefined;
  let seerIndex: number | undefined;
  let witchIndex: number | undefined;

  room.players.forEach((player, seat) => {
    if (player?.role === 'wolfQueen') queenIndex = seat;
    if (player?.role === 'dreamcatcher') dreamcatcherIndex = seat;
    if (player?.role === 'witcher') witcherIndex = seat;
    if (player?.role === 'spiritKnight') spiritKnightIndex = seat;
    if (player?.role === 'seer') seerIndex = seat;
    if (player?.role === 'witch') witchIndex = seat;
  });

  return { queenIndex, dreamcatcherIndex, witcherIndex, spiritKnightIndex, seerIndex, witchIndex };
}

// Apply magician swap to deaths
function applyMagicianSwap(
  deaths: Set<number>,
  firstExchanged?: number,
  secondExchanged?: number,
): void {
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
  // Extract targets from structured actions
  const wolfKillSeat = getActionTargetSeat(room.actions.get('wolf'));
  const witchAction = room.actions.get('witch');
  const { killedByWitch, savedByWitch } = parseWitchActionFromRoleAction(witchAction);
  const sleptWithSeat = getActionTargetSeat(room.actions.get('wolfQueen'));
  const guardProtectSeat = getActionTargetSeat(room.actions.get('guard'));
  const nightWalkerSeat = getActionTargetSeat(room.actions.get('dreamcatcher'));
  const seerCheckedSeat = getActionTargetSeat(room.actions.get('seer'));
  const { firstExchanged, secondExchanged } = parseMagicianActionFromRoleAction(
    room.actions.get('magician'),
  );
  const { queenIndex, dreamcatcherIndex, witcherIndex, spiritKnightIndex, seerIndex, witchIndex } =
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
  if (killedByWitch !== null && witcherIndex !== killedByWitch) {
    deaths.add(killedByWitch);
  }

  // Spirit Knight reflect rules:
  // - If seer checks spiritKnight, seer dies (next day). We model it as a death in last night info.
  // - If witch poisons spiritKnight, witch dies (next day) and poison is ineffective.
  if (spiritKnightIndex !== undefined) {
    if (
      seerCheckedSeat !== undefined &&
      seerCheckedSeat === spiritKnightIndex &&
      seerIndex !== undefined
    ) {
      deaths.add(seerIndex);
    }

    if (killedByWitch !== null && killedByWitch === spiritKnightIndex) {
      // Poison has no effect on spirit knight
      deaths.delete(spiritKnightIndex);

      // Witch dies by reflection
      if (witchIndex !== undefined) {
        deaths.add(witchIndex);
      }
    }
  }

  // Wolf queen dies, linked player dies too
  if (queenIndex !== undefined && deaths.has(queenIndex) && sleptWithSeat !== undefined) {
    deaths.add(sleptWithSeat);
  }

  // Dreamcatcher protects dream target from death
  if (nightWalkerSeat !== undefined) {
    deaths.delete(nightWalkerSeat);
  }

  // Dreamcatcher dies, dreamer dies too
  if (
    dreamcatcherIndex !== undefined &&
    deaths.has(dreamcatcherIndex) &&
    nightWalkerSeat !== undefined
  ) {
    deaths.add(nightWalkerSeat);
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



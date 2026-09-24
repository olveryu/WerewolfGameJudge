/** Fail-fast Undercover invariants for the trusted typed engine state. */

import {
  getUndercoverRoleCounts,
  getUndercoverWinner,
  UNDERCOVER_BLANK_MIN_PLAYERS,
  UNDERCOVER_MAX_PLAYERS,
  UNDERCOVER_MIN_PLAYERS,
} from '../domain/rules';
import {
  getUndercoverOccupiedSeatCount,
  isUndercoverSeat,
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_STATE_VERSION,
  type UndercoverConfig,
  type UndercoverState,
  type UndercoverWordPair,
} from './types';

/** Validates a configuration without substituting defaults. */
export function isValidUndercoverConfig(config: UndercoverConfig): boolean {
  return (
    Number.isSafeInteger(config.numberOfPlayers) &&
    config.numberOfPlayers >= UNDERCOVER_MIN_PLAYERS &&
    config.numberOfPlayers <= UNDERCOVER_MAX_PLAYERS &&
    typeof config.hasBlank === 'boolean' &&
    (!config.hasBlank || config.numberOfPlayers >= UNDERCOVER_BLANK_MIN_PLAYERS) &&
    (config.category === 'all' ||
      UNDERCOVER_CATEGORIES.some((category) => category === config.category))
  );
}

/** Validates a selected word pair; content quality belongs to the supply review pipeline. */
export function isValidUndercoverWordPair(pair: UndercoverWordPair): boolean {
  return (
    pair.id.trim().length > 0 &&
    [pair.wordA, pair.wordB].every((word) => word.length > 0 && word.trim() === word) &&
    pair.wordA !== pair.wordB &&
    UNDERCOVER_CATEGORIES.some((category) => category === pair.category)
  );
}

function assertSeats(state: UndercoverState): void {
  const userIds = new Set<string>();
  for (const [key, occupant] of Object.entries(state.realSeats)) {
    const seat = Number(key);
    if (
      occupant === undefined ||
      !isUndercoverSeat(state, seat) ||
      String(seat) !== key ||
      occupant.seat !== seat ||
      occupant.userId.length === 0 ||
      occupant.profile.displayName.trim().length === 0 ||
      userIds.has(occupant.userId)
    ) {
      throw new Error('Invalid Undercover human seat');
    }
    userIds.add(occupant.userId);
  }
  if (
    new Set(state.botSeats).size !== state.botSeats.length ||
    state.botSeats.some(
      (seat) => !isUndercoverSeat(state, seat) || state.realSeats[seat] !== undefined,
    )
  )
    throw new Error('Invalid Undercover robot seats');
}

function assertRound(state: UndercoverState): void {
  if (state.round === null) return;
  const { round } = state;
  if (
    !isValidUndercoverWordPair(round.wordPair) ||
    !state.usedWordPairIds.includes(round.wordPair.id) ||
    round.roundId.length === 0 ||
    !isUndercoverSeat(state, round.speakingStartSeat) ||
    round.roles.length !== state.config.numberOfPlayers
  )
    throw new Error('Invalid Undercover round');
  const counts = getUndercoverRoleCounts(state.config.numberOfPlayers, state.config.hasBlank);
  for (const role of ['civilian', 'undercover', 'blank'] as const) {
    if (round.roles.filter((assigned) => assigned === role).length !== counts[role])
      throw new Error('Invalid Undercover role distribution');
  }
  if (
    round.civilianWord === round.undercoverWord ||
    ![round.wordPair.wordA, round.wordPair.wordB].includes(round.civilianWord) ||
    ![round.wordPair.wordA, round.wordPair.wordB].includes(round.undercoverWord)
  )
    throw new Error('Invalid Undercover word assignment');
  if (
    new Set(round.confirmedSeats).size !== round.confirmedSeats.length ||
    round.confirmedSeats.some((seat) => !isUndercoverSeat(state, seat))
  ) {
    throw new Error('Invalid Undercover confirmations');
  }
  const revealed = new Set<number>();
  for (const revelation of round.revelations) {
    if (
      !isUndercoverSeat(state, revelation.seat) ||
      revealed.has(revelation.seat) ||
      round.roles[revelation.seat] !== revelation.role ||
      !Number.isFinite(revelation.revealedAt)
    ) {
      throw new Error('Invalid Undercover revelation');
    }
    revealed.add(revelation.seat);
  }
  if (
    state.phase === 'reading' &&
    (revealed.size !== 0 || round.confirmedSeats.length === state.config.numberOfPlayers)
  )
    throw new Error('Invalid Undercover reading phase');
  if (state.phase === 'ongoing' || state.phase === 'ended') {
    if (round.confirmedSeats.length !== state.config.numberOfPlayers)
      throw new Error('Missing Undercover confirmations');
    const winner = getUndercoverWinner(round.roles.filter((_, seat) => !revealed.has(seat)));
    if (state.phase === 'ended' ? winner !== state.winner : winner !== null)
      throw new Error('Invalid Undercover winner');
  }
}

/** Rejects invalid authoritative state instead of repairing or erasing game data. */
export function normalizeUndercoverState(state: UndercoverState): UndercoverState {
  if (
    state.gameType !== 'undercover' ||
    state.stateVersion !== UNDERCOVER_STATE_VERSION ||
    state.roomCode.length === 0 ||
    state.hostUserId.length === 0 ||
    !isValidUndercoverConfig(state.config)
  ) {
    throw new Error('Invalid Undercover state identity or config');
  }
  assertSeats(state);
  if (
    new Set(state.usedWordPairIds).size !== state.usedWordPairIds.length ||
    state.usedWordPairIds.some((id) => id.length === 0)
  )
    throw new Error('Invalid Undercover used word history');
  if (
    state.phase !== 'lobby' &&
    getUndercoverOccupiedSeatCount(state) !== state.config.numberOfPlayers
  )
    throw new Error('Undercover active roster must be full');
  if (state.phase === 'preparing' || state.phase === 'preparationFailed') {
    if (state.pendingRound.roundId.length === 0 || !Number.isFinite(state.pendingRound.requestedAt))
      throw new Error('Invalid Undercover preparation');
  }
  assertRound(state);
  return state;
}

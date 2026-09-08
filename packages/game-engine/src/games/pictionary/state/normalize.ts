/** Fail-fast Pictionary state invariant enforcement. */

import { PICTIONARY_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import {
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  isPictionaryRoomFull,
  isValidPictionaryConfig,
  isValidPictionaryText,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
  type PictionaryEntry,
  type PictionaryState,
} from './types';
import { PICTIONARY_STATE_VERSION } from './version';

function assertNonEmpty(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must be non-empty`);
}

function assertSafeTimestamp(value: number | null, label: string): void {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} must be null or a non-negative safe integer`);
  }
}

function assertEntry(
  state: PictionaryState,
  entry: PictionaryEntry,
  chainIndex: number,
  entryIndex: number,
): void {
  const expectedKind = getPictionaryExpectedKind(entryIndex);
  const expectedAuthorSeat =
    state.seatOrder[(chainIndex + entryIndex) % state.config.numberOfPlayers];
  if (entry.authorSeat !== expectedAuthorSeat) {
    throw new Error('Pictionary entry author does not match relay assignment');
  }
  if (entry.kind === 'missed') {
    if (entry.expectedKind !== expectedKind) {
      throw new Error('Pictionary missed entry kind does not match relay step');
    }
    return;
  }
  if (entry.kind !== expectedKind) {
    throw new Error('Pictionary entry kind does not match relay step');
  }
  if (entry.kind === 'text' && !isValidPictionaryText(entry.text)) {
    throw new Error('Pictionary text entry is invalid');
  }
  if (entry.kind === 'drawing') {
    const { media } = entry;
    if (
      media.contentType !== 'image/png' ||
      media.width !== PICTIONARY_DRAWING_WIDTH ||
      media.height !== PICTIONARY_DRAWING_HEIGHT ||
      !Number.isSafeInteger(media.byteLength) ||
      media.byteLength <= 0 ||
      media.byteLength > PICTIONARY_DRAWING_MAX_BYTES
    ) {
      throw new Error('Pictionary drawing metadata is invalid');
    }
    assertNonEmpty(media.objectKey, 'Pictionary media objectKey');
    assertNonEmpty(media.sha256, 'Pictionary media sha256');
  }
}

function assertSeats(state: PictionaryState): void {
  const userIds = new Set<string>();
  for (const [rawSeat, occupant] of Object.entries(state.realSeats)) {
    const seat = Number(rawSeat);
    if (!Number.isSafeInteger(seat) || String(seat) !== rawSeat || seat < 0) {
      throw new Error(`Pictionary seat key ${rawSeat} is invalid`);
    }
    if (seat >= state.config.numberOfPlayers || occupant === undefined || occupant.seat !== seat) {
      throw new Error(`Pictionary seat ${rawSeat} is outside the configured room`);
    }
    assertNonEmpty(occupant.userId, `Pictionary seat ${seat} userId`);
    assertNonEmpty(occupant.profile.displayName, `Pictionary seat ${seat} displayName`);
    if (userIds.has(occupant.userId)) {
      throw new Error(`Pictionary user ${occupant.userId} occupies multiple seats`);
    }
    userIds.add(occupant.userId);
  }
}

function assertExcludedBotSeats(state: PictionaryState): void {
  if (!state.fillEmptySeatsWithBots && state.excludedBotSeats.length > 0) {
    throw new Error('Pictionary excludedBotSeats requires bot fill to be enabled');
  }
  let previousSeat = -1;
  for (const seat of state.excludedBotSeats) {
    if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers) {
      throw new Error(`Pictionary excluded bot seat ${seat} is outside the configured room`);
    }
    if (seat <= previousSeat) {
      throw new Error('Pictionary excludedBotSeats must be unique and strictly ascending');
    }
    previousSeat = seat;
  }
}

function assertRound(state: PictionaryState): void {
  if (state.roundId === null) throw new Error('Pictionary active phase requires a roundId');
  if (!isPictionaryRoomFull(state)) throw new Error('Pictionary active phase requires a full room');
  const numberOfPlayers = state.config.numberOfPlayers;
  if (
    state.seatOrder.length !== numberOfPlayers ||
    new Set(state.seatOrder).size !== numberOfPlayers
  ) {
    throw new Error('Pictionary seatOrder must contain every configured seat exactly once');
  }
  if (state.chains.length !== numberOfPlayers) {
    throw new Error('Pictionary round must contain one chain per player');
  }
  const relayStepCount = getPictionaryRelayStepCount(numberOfPlayers);
  state.chains.forEach((chain, chainIndex) => {
    if (chain.originSeat !== state.seatOrder[chainIndex]) {
      throw new Error('Pictionary chain order must match seatOrder');
    }
    if (chain.entries.length > relayStepCount) {
      throw new Error('Pictionary chain exceeds the relay length');
    }
    chain.entries.forEach((entry, entryIndex) => assertEntry(state, entry, chainIndex, entryIndex));
  });
}

export function normalizePictionaryState(state: PictionaryState): PictionaryState {
  if (state.gameType !== PICTIONARY_GAME_TYPE) {
    throw new Error(`Pictionary gameType must be ${PICTIONARY_GAME_TYPE}`);
  }
  if (state.stateVersion !== PICTIONARY_STATE_VERSION) {
    throw new Error(`Unsupported Pictionary state version ${state.stateVersion}`);
  }
  assertNonEmpty(state.roomCode, 'Pictionary roomCode');
  assertNonEmpty(state.hostUserId, 'Pictionary hostUserId');
  if (!isValidPictionaryConfig(state.config)) throw new Error('Pictionary config is invalid');
  if (!Number.isSafeInteger(state.phaseRevision) || state.phaseRevision < 0) {
    throw new Error('Pictionary phaseRevision must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(state.roundNumber) || state.roundNumber < 0) {
    throw new Error('Pictionary roundNumber must be a non-negative safe integer');
  }
  assertSafeTimestamp(state.deadlineAt, 'Pictionary deadlineAt');
  assertSeats(state);
  assertExcludedBotSeats(state);

  if (state.phase === 'lobby') {
    if (
      state.roundId !== null ||
      state.seatOrder.length > 0 ||
      state.stepIndex !== -1 ||
      state.deadlineAt !== null ||
      state.reservations.length > 0 ||
      state.chains.length > 0 ||
      state.gallery !== null
    ) {
      throw new Error('Pictionary lobby cannot carry round state');
    }
    return state;
  }

  assertRound(state);
  const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
  if (state.stepIndex < 0 || state.stepIndex >= relayStepCount) {
    throw new Error('Pictionary stepIndex is outside the round');
  }
  if (state.phase === 'gallery' || state.phase === 'ended') {
    if (state.chains.some((chain) => chain.entries.length !== relayStepCount)) {
      throw new Error('Pictionary gallery requires complete chains');
    }
    if (state.gallery === null) throw new Error('Pictionary gallery state is required');
  } else if (state.gallery !== null) {
    throw new Error('Pictionary gallery state is only valid during reveal');
  }
  if (state.phase !== 'answering' && state.phase !== 'settling' && state.reservations.length > 0) {
    throw new Error('Pictionary reservations are only valid while resolving drawings');
  }
  return state;
}

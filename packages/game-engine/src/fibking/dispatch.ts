/**
 * dispatchFib — the fibking Command router.
 *
 * Maps an inbound `actionType` to a pure handler that validates state preconditions
 * (phase guards, seat rules) and returns an EngineResult<FibAction>. All precondition
 * failures are `engineError` (fail-fast: no state change, surfaced to the caller).
 *
 * Payloads arrive already validated by the api-worker zod boundary, so handlers cast
 * `action.payload` to the expected shape (single trusted-boundary cast, like the DO's
 * existing `blob as GameState`). Host-only authorization is enforced at the REST layer.
 */

import type { EngineResult, GameAction } from '../engine/registry/types';
import { engineError, engineSuccess } from '../engine/registry/types';
import { seatClearAll, seatJoin, seatKick, seatLeave } from '../engine/seating/kernel';
import {
  SEAT_KERNEL_INVALID_SEAT,
  SEAT_KERNEL_NOT_SEATED,
  SEAT_KERNEL_SEAT_EMPTY,
  SEAT_KERNEL_SEAT_TAKEN,
} from '../engine/seating/types';
import type { RosterEntry } from '../protocol/common';
import type { Rng } from '../utils/random';
import { secureRng } from '../utils/random';
import { assignFibRoles } from './assignRoles';
import type { FibAction, FibState, FibWordSource } from './types';
import { FIB_MIN_PLAYERS } from './types';

interface SitPayload {
  userId: string;
  seat: number;
  profile: RosterEntry;
}
interface LeavePayload {
  userId: string;
}
interface KickPayload {
  targetSeat: number;
}
interface UpdateConfigPayload {
  numberOfPlayers: number;
}
interface StartRoundPayload {
  word: string;
  definition: string;
  source: FibWordSource;
}

/** Optional deps for deterministic testing (inject a seeded RNG). */
export interface FibDispatchDeps {
  rng?: Rng;
}

function seatedSeats(state: FibState): number[] {
  return Object.keys(state.seats).map(Number);
}

const isLobby = (state: FibState): boolean => state.phase === 'Lobby';

export function dispatchFib(
  state: FibState,
  _revision: number,
  action: GameAction,
  deps: FibDispatchDeps = {},
): EngineResult<FibAction> {
  const rng = deps.rng ?? secureRng;
  switch (action.actionType) {
    case 'SIT':
      return handleSit(state, action.payload as SitPayload);
    case 'LEAVE':
      return handleLeave(state, action.payload as LeavePayload);
    case 'KICK':
      return handleKick(state, action.payload as KickPayload);
    case 'CLEAR_SEATS':
      return handleClearSeats(state);
    case 'FILL_BOTS':
      return handleFillBots(state);
    case 'UPDATE_CONFIG':
      return handleUpdateConfig(state, action.payload as UpdateConfigPayload);
    case 'BEGIN_DRAW':
      return handleBeginDraw(state);
    case 'START_ROUND':
      return handleStartRound(state, action.payload as StartRoundPayload, rng);
    case 'ABORT_DRAW':
      return handleAbortDraw(state);
    case 'REVEAL':
      return handleReveal(state);
    case 'RESTART':
      return handleRestart(state);
    default:
      return engineError(`UNKNOWN_ACTION:${action.actionType}`);
  }
}

function handleSit(state: FibState, p: SitPayload): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');
  const op = seatJoin(state.seats, state.numberOfPlayers, p.seat, p.userId, (seat) => ({
    userId: p.userId,
    seat,
  }));
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_INVALID_SEAT) return engineError('BAD_SEAT');
    if (op.reason === SEAT_KERNEL_SEAT_TAKEN) return engineError('SEAT_TAKEN');
    return engineError(op.reason);
  }
  return engineSuccess<FibAction>([
    ...op.changes.map(
      (change): FibAction => ({ type: 'SET_SEAT', seat: change.seat, value: change.value }),
    ),
    { type: 'SET_ROSTER', userId: p.userId, entry: p.profile },
  ]);
}

function handleLeave(state: FibState, p: LeavePayload): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');
  const op = seatLeave(state.seats, p.userId);
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_NOT_SEATED) return engineError('NOT_SEATED');
    return engineError(op.reason);
  }
  return engineSuccess<FibAction>([
    ...op.changes.map(
      (change): FibAction => ({ type: 'SET_SEAT', seat: change.seat, value: null }),
    ),
    { type: 'REMOVE_ROSTER', userId: p.userId },
  ]);
}

function handleKick(state: FibState, p: KickPayload): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');
  const op = seatKick(state.seats, state.numberOfPlayers, p.targetSeat);
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_INVALID_SEAT) return engineError('BAD_SEAT');
    if (op.reason === SEAT_KERNEL_SEAT_EMPTY) return engineError('SEAT_EMPTY');
    return engineError(op.reason);
  }
  const actions: FibAction[] = [];
  for (const change of op.changes) {
    actions.push({ type: 'SET_SEAT', seat: change.seat, value: null });
    if (change.previous) actions.push({ type: 'REMOVE_ROSTER', userId: change.previous.userId });
  }
  return engineSuccess<FibAction>(actions);
}

function handleClearSeats(state: FibState): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');
  const op = seatClearAll(state.seats);
  if (op.kind === 'error') return engineError(op.reason);
  return engineSuccess<FibAction>([{ type: 'CLEAR_ALL_SEATS' }]);
}

function createFibBotUserId(seat: number): string {
  return `bot-${seat}`;
}

function createFibBotProfile(seat: number): RosterEntry {
  return { displayName: `机器人${seat + 1}号` };
}

function handleFillBots(state: FibState): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');

  const actions: FibAction[] = [];
  for (let seat = 0; seat < state.numberOfPlayers; seat++) {
    if (state.seats[seat]) continue;
    const userId = createFibBotUserId(seat);
    actions.push({ type: 'SET_SEAT', seat, value: { userId, seat } });
    actions.push({ type: 'SET_ROSTER', userId, entry: createFibBotProfile(seat) });
  }
  return engineSuccess<FibAction>(actions);
}

function handleUpdateConfig(state: FibState, p: UpdateConfigPayload): EngineResult<FibAction> {
  if (!isLobby(state)) return engineError('NOT_LOBBY');
  const n = p.numberOfPlayers;
  if (!Number.isInteger(n) || n < FIB_MIN_PLAYERS) {
    return engineError('BAD_PLAYER_COUNT');
  }
  // Shrinking is only allowed when every seat being removed (index ≥ n) is empty.
  for (const seat of Object.keys(state.seats)) {
    if (Number(seat) >= n) return engineError('SEAT_OCCUPIED_ABOVE_LIMIT');
  }
  if (n === state.numberOfPlayers) return engineSuccess<FibAction>([]); // no-op
  return engineSuccess<FibAction>([{ type: 'RESIZE_SEATS', numberOfPlayers: n }]);
}

function handleBeginDraw(state: FibState): EngineResult<FibAction> {
  if (state.phase !== 'Lobby' && state.phase !== 'Revealed') return engineError('BAD_PHASE');
  if (seatedSeats(state).length !== state.numberOfPlayers) return engineError('NOT_FULL');
  return engineSuccess<FibAction>([
    { type: 'CLEAR_ROUND' },
    { type: 'SET_PHASE', phase: 'Starting' },
  ]);
}

function handleStartRound(
  state: FibState,
  p: StartRoundPayload,
  rng: Rng,
): EngineResult<FibAction> {
  if (state.phase !== 'Starting') return engineError('NOT_STARTING');
  const roleBySeat = assignFibRoles(seatedSeats(state), rng);
  return engineSuccess<FibAction>([
    {
      type: 'SET_ROUND',
      word: p.word,
      definition: p.definition,
      roleBySeat,
      wordSource: p.source,
    },
    { type: 'ADD_USED_WORD', word: p.word },
    { type: 'SET_PHASE', phase: 'Playing' },
  ]);
}

function handleAbortDraw(state: FibState): EngineResult<FibAction> {
  if (state.phase !== 'Starting') return engineError('NOT_STARTING');
  return engineSuccess<FibAction>([{ type: 'CLEAR_ROUND' }, { type: 'SET_PHASE', phase: 'Lobby' }]);
}

function handleReveal(state: FibState): EngineResult<FibAction> {
  if (state.phase !== 'Playing') return engineError('NOT_PLAYING');
  return engineSuccess<FibAction>([{ type: 'SET_PHASE', phase: 'Revealed' }]);
}

function handleRestart(state: FibState): EngineResult<FibAction> {
  if (state.phase === 'Lobby') return engineError('ALREADY_LOBBY');
  return engineSuccess<FibAction>([
    { type: 'CLEAR_ROUND' },
    { type: 'CLEAR_USED_WORDS' },
    { type: 'SET_PHASE', phase: 'Lobby' },
  ]);
}

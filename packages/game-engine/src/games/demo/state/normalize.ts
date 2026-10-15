/** Demo semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import { isBotOccupant } from '../../../platform/room/seating';
import { type DemoHumanSeat, type DemoState, isDemoOccupiedSeat, isValidDemoConfig } from './types';
import { DEMO_STATE_IDENTITY } from './version';

const invariant: StateInvariant = createStateInvariant('Demo');

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeDemoState(state: DemoState): DemoState {
  assertStateIdentity(state, DEMO_STATE_IDENTITY, 'Demo');
  invariant(isValidDemoConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  invariant(typeof state.xpSettled === 'boolean', 'xp settled flag');
  if (state.phase.kind === 'playing') {
    invariant(
      Number.isSafeInteger(state.phase.deadlineAt) && state.phase.deadlineAt >= 0,
      'stage deadline',
    );
  }
  const entries = Object.entries(state.roster);
  invariant(
    entries.every(
      ([seat, occupant]) =>
        occupant != null &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        (isBotOccupant(occupant) || occupant.profile.displayName.trim().length > 0),
    ),
    'roster seats',
  );
  const users = entries.filter(
    (entry): entry is [string, DemoHumanSeat] => entry[1] != null && !isBotOccupant(entry[1]),
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant.userId)).size === users.length,
    'duplicate user',
  );
  invariant(
    state.roleViewedSeats.every((seat) => isSeat(seat) && isDemoOccupiedSeat(state, seat)) &&
      new Set(state.roleViewedSeats).size === state.roleViewedSeats.length,
    'role viewed seats',
  );
  // 发牌后身份表必须恰好覆盖全部已占座位；大厅里必须为空。
  const identitySeats = Object.keys(state.identities).map(Number);
  if (state.phase.kind === 'lobby') {
    invariant(identitySeats.length === 0, 'lobby identities');
    invariant(state.roleViewedSeats.length === 0, 'lobby viewed seats');
  } else {
    invariant(
      identitySeats.every((seat) => isSeat(seat) && isDemoOccupiedSeat(state, seat)) &&
        identitySeats.length === entries.length,
      'dealt identities',
    );
  }
  if (state.phase.kind === 'ended') invariant(state.xpSettled, 'ended settles exactly once');
  return state;
}

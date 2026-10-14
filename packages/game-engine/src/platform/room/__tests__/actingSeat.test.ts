/**
 * Acting-seat resolution — the shared bot-takeover seat resolver.
 *
 * Pins the gate order every game now shares: user actor, host gate,
 * bot gate, own-seat lookup. Per-game wiring is pinned by each game's
 * botTakeoverResolution contract scenarios.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';
import { type ActingSeatSlice, resolveActingSeat, resolveActingSeatForUser } from '../actingSeat';
import type { RosterMap, SeatOccupant } from '../seating';

// Seat 0: host (human). Seat 1: guest (human). Seat 2: bot. Seat 3: empty.
const SLICE: ActingSeatSlice = {
  hostUserId: 'host',
  roster: {
    0: { seat: 0, userId: 'host' },
    1: { seat: 1, userId: 'guest' },
    2: { seat: 2, kind: 'bot' },
  } satisfies RosterMap<SeatOccupant>,
};

function user(userId: string, controlledSeat: number | null = null): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId: 'command-1',
    randomSeed: 'acting-seat-test',
    nowMs: 1000,
  };
}

const SYSTEM: CommandContext = {
  actor: { kind: 'system', effectId: 'effect-1' },
  controlledSeat: null,
  commandId: 'command-1',
  randomSeed: 'acting-seat-test',
  nowMs: 1000,
};

describe('resolveActingSeat', () => {
  it('requires a user actor', () => {
    expect(resolveActingSeat(SLICE, 4, SYSTEM)).toEqual({
      kind: 'rejected',
      reason: REASON_USER_ACTOR_REQUIRED,
    });
  });

  it('resolves a seated user to their own seat', () => {
    expect(resolveActingSeat(SLICE, 4, user('guest'))).toEqual({ kind: 'resolved', value: 1 });
    expect(resolveActingSeat(SLICE, 4, user('host'))).toEqual({ kind: 'resolved', value: 0 });
  });

  it('rejects a user with no seat', () => {
    expect(resolveActingSeat(SLICE, 4, user('outsider'))).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_SEATED,
    });
  });

  it('rejects a non-host controlling any seat, bot or not', () => {
    expect(resolveActingSeat(SLICE, 4, user('guest', 2))).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_HOST,
    });
    expect(resolveActingSeat(SLICE, 4, user('guest', 1))).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_HOST,
    });
  });

  it('rejects the host controlling a human seat', () => {
    expect(resolveActingSeat(SLICE, 4, user('host', 1))).toEqual({
      kind: 'rejected',
      reason: REASON_CONTROLLED_SEAT_NOT_BOT,
    });
  });

  it('rejects the host controlling an empty seat (no occupant is not a bot)', () => {
    expect(resolveActingSeat(SLICE, 4, user('host', 3))).toEqual({
      kind: 'rejected',
      reason: REASON_CONTROLLED_SEAT_NOT_BOT,
    });
  });

  it('resolves the host controlling a bot seat to that seat', () => {
    expect(resolveActingSeat(SLICE, 4, user('host', 2))).toEqual({ kind: 'resolved', value: 2 });
  });
});

describe('resolveActingSeatForUser', () => {
  it('resolves a seated user to their own seat', () => {
    expect(resolveActingSeatForUser(SLICE, 4, 'guest', null)).toEqual({
      kind: 'resolved',
      value: 1,
    });
    expect(resolveActingSeatForUser(SLICE, 4, 'host', null)).toEqual({
      kind: 'resolved',
      value: 0,
    });
  });

  it('rejects a user with no seat', () => {
    expect(resolveActingSeatForUser(SLICE, 4, 'outsider', null)).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_SEATED,
    });
  });

  it('rejects a non-host controlling any seat, bot or not', () => {
    expect(resolveActingSeatForUser(SLICE, 4, 'guest', 2)).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_HOST,
    });
    expect(resolveActingSeatForUser(SLICE, 4, 'guest', 1)).toEqual({
      kind: 'rejected',
      reason: REASON_NOT_HOST,
    });
  });

  it('rejects the host controlling a human or empty seat', () => {
    expect(resolveActingSeatForUser(SLICE, 4, 'host', 1)).toEqual({
      kind: 'rejected',
      reason: REASON_CONTROLLED_SEAT_NOT_BOT,
    });
    expect(resolveActingSeatForUser(SLICE, 4, 'host', 3)).toEqual({
      kind: 'rejected',
      reason: REASON_CONTROLLED_SEAT_NOT_BOT,
    });
  });

  it('resolves the host controlling a bot seat to that seat', () => {
    expect(resolveActingSeatForUser(SLICE, 4, 'host', 2)).toEqual({ kind: 'resolved', value: 2 });
  });
});

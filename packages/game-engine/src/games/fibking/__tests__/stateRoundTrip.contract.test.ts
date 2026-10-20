/**
 * Persistence round-trip contract — fibking stored state is a parse
 * fixed point (E-1 PR-4 regression).
 *
 * The worker repository stores `JSON.stringify(state)` verbatim and,
 * for a rejected command, re-parses the stored JSON and throws
 * 'Rejected commands cannot change state or create effects' when the
 * re-serialized parse differs from the stored string
 * (roomRepository.ts persist). Every fibking state producer must
 * therefore emit objects in exactly the key order `parseFibState`
 * rebuilds: the canonical human seat is { seat, userId, profile }
 * (the platform room-command skeleton's shape) and the canonical
 * top-level order is the parser's base-then-phase order. PR #252
 * exposed fibking's parser rebuilding human seats as
 * { userId, seat, profile }: after the first seat take committed, the
 * next rejected command (the e2e shrink attempt) observed a phantom
 * state change and the worker returned 500.
 *
 * This harness replays commands the way the worker does — re-parse
 * from the stored string per command, persist commits with state
 * events back to a string — and asserts the persist guards hold at
 * every step, including rejects issued before any commit.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import type { FibCommand } from '../commands/types';
import {
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
} from '../domain/reasons';
import { fibEngine } from '../engine';
import { parseFibState } from '../state/parseState';
import type { FibState } from '../state/types';

function context(userId: string): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 1000,
    commandId: `cmd-${userId}`,
    randomSeed: 'round-trip',
  };
}

/** A stored room, driven exactly like the worker pipeline drives it. */
class StoredRoom {
  #stored: string;

  constructor(numberOfPlayers: number) {
    // repository.initialize stores JSON.stringify(created.state) verbatim.
    const created = fibEngine.normalize(
      fibEngine.createInitialState(
        { numberOfPlayers },
        { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
      ),
    );
    this.#stored = JSON.stringify(created);
    this.#expectFixedPoint();
  }

  #expectFixedPoint(): void {
    expect(JSON.stringify(parseFibState(JSON.parse(this.#stored)))).toBe(this.#stored);
  }

  /** Returns the rejection reason, or null when the command commits. */
  dispatch(command: FibCommand, userId: string): string | null {
    let state: FibState = fibEngine.normalize(parseFibState(JSON.parse(this.#stored)));
    const decision = fibEngine.decide(state, command, context(userId));
    if (decision.kind === 'reject') {
      // persist() reject branch: the re-parsed state must serialize
      // back to the stored string byte for byte.
      expect(JSON.stringify(state)).toBe(this.#stored);
      return decision.reason;
    }
    for (const event of decision.events) state = fibEngine.evolve(state, event);
    state = fibEngine.normalize(state);
    if (decision.events.length > 0) {
      this.#stored = JSON.stringify(state);
    } else {
      // persist() also guards eventless commits against state drift.
      expect(JSON.stringify(state)).toBe(this.#stored);
    }
    this.#expectFixedPoint();
    return null;
  }
}

describe('FibKing persistence round-trip', () => {
  it('keeps rejects phantom-free across the e2e lobby opening sequence', () => {
    const room = new StoredRoom(8);

    // A reject before any commit: profile update from a user with no seat.
    expect(
      room.dispatch({ type: 'room.profile.update', profile: { displayName: 'Ghost' } }, 'ghost'),
    ).toBe(REASON_NOT_SEATED);

    // The e2e seat takes: host 0, joiners 1 and 2, cold joiner 7.
    for (const [seat, userId] of [
      [0, 'host'],
      [1, 'u1'],
      [2, 'u2'],
      [7, 'u7'],
    ] as const) {
      expect(
        room.dispatch(
          { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
          userId,
        ),
      ).toBeNull();
    }

    // The e2e shrink attempt: seat 7 is occupied beyond the target.
    expect(room.dispatch({ type: 'fibking.config.update', numberOfPlayers: 4 }, 'host')).toBe(
      REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
    );

    // Saving the current count back is an eventless no-op commit.
    expect(room.dispatch({ type: 'fibking.config.update', numberOfPlayers: 8 }, 'host')).toBeNull();

    // Cold joiner moves inside the kept range, seat 1 is kicked and retaken.
    expect(
      room.dispatch({ type: 'room.seat.take', seat: 3, profile: { displayName: 'P3' } }, 'u7'),
    ).toBeNull();
    expect(room.dispatch({ type: 'room.seat.kick', seat: 1 }, 'host')).toBeNull();
    expect(
      room.dispatch({ type: 'room.seat.take', seat: 1, profile: { displayName: 'P1' } }, 'u1'),
    ).toBeNull();

    // Now the shrink to four is legal and commits.
    expect(room.dispatch({ type: 'fibking.config.update', numberOfPlayers: 4 }, 'host')).toBeNull();

    // A reject after the config commit still observes no phantom change.
    expect(room.dispatch({ type: 'fibking.config.update', numberOfPlayers: 3 }, 'host')).toBe(
      REASON_FIB_PLAYER_COUNT_INVALID,
    );
  });

  it('keeps bot occupants and profile events inside the fixed point', () => {
    const room = new StoredRoom(4);
    expect(
      room.dispatch(
        {
          type: 'room.seat.take',
          seat: 0,
          profile: { displayName: 'Host', avatarUrl: 'https://example.test/a.png', level: 3 },
        },
        'host',
      ),
    ).toBeNull();
    expect(room.dispatch({ type: 'room.seat.fillBots' }, 'host')).toBeNull();

    // Profile updates land as the standalone event; the stored state
    // afterwards must still round-trip before the next reject.
    expect(
      room.dispatch({ type: 'room.profile.update', profile: { displayName: 'Renamed' } }, 'host'),
    ).toBeNull();
    expect(room.dispatch({ type: 'fibking.config.update', numberOfPlayers: 3 }, 'host')).toBe(
      REASON_FIB_PLAYER_COUNT_INVALID,
    );
  });
});

/**
 * Persistence round-trip contract — pictionary stored state is a
 * parse fixed point (E-1 PR-5, same regression class as fibking
 * PR #252).
 *
 * The worker repository stores `JSON.stringify(state)` verbatim and,
 * for a rejected command, re-parses the stored JSON and throws
 * 'Rejected commands cannot change state or create effects' when the
 * re-serialized parse differs from the stored string
 * (roomRepository.ts persist). Every pictionary state producer must
 * therefore emit objects in exactly the key order
 * `parsePictionaryState` rebuilds:
 *
 * - top level: the parser's field order — `createInitialPictionaryState`
 *   already matches it (identity, roomCode, hostUserId, phase,
 *   phaseRevision, config, roster, then the round fields);
 * - human seats: { seat, userId, profile }, the platform skeleton's
 *   occupant shape — pictionary's parser already rebuilds that order;
 * - profiles: the platform RosterEntry order (displayName, avatarUrl,
 *   avatarFrame, seatFlair, seatAnimation, nameStyle, revealEffect,
 *   level). The producer outlier was the worker's zod command schema,
 *   which declared seatAnimation after revealEffect; that schema is
 *   fixed and its order is pinned in the api-worker
 *   commandSchemas.test.ts. The take profiles below are written in
 *   that canonical order, as the parsed commands now deliver them.
 *
 * This harness replays commands the way the worker does — re-parse
 * from the stored string per command, persist commits with state
 * events back to a string — and asserts the persist guards hold at
 * every step: a full lobby opening with a post-seating reject, and a
 * complete round (participants, chains, text/drawing/missed entries,
 * reservations, gallery) so the round subtrees stay inside the fixed
 * point as well.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_GAME_IN_PROGRESS, REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import type { PictionaryInternalCommand } from '../commands/types';
import {
  REASON_PICTIONARY_CONFIG_INVALID,
  REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
} from '../domain/reasons';
import { pictionaryEngine } from '../engine';
import { parsePictionaryState } from '../state/parseState';
import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  type PictionaryConfig,
  type PictionaryState,
} from '../state/types';
import { decidePictionaryInput, type PictionaryInput } from './commandBinding';

const HOST = 'host';
const BOT_SEAT = 3;

const FULL_PROFILE = {
  displayName: 'Host',
  avatarUrl: 'https://example.test/a.png',
  avatarFrame: 'frame-1',
  seatFlair: 'flair-1',
  seatAnimation: 'anim-1',
  nameStyle: 'style-1',
  revealEffect: 'fx-1',
  level: 3,
} as const;

/** A stored room, driven exactly like the worker pipeline drives it. */
class StoredRoom {
  #stored: string;
  #commandCounter = 0;

  constructor(config: PictionaryConfig) {
    // repository.initialize stores JSON.stringify(created.state) verbatim.
    const created = pictionaryEngine.normalize(
      pictionaryEngine.createInitialState(config, {
        roomCode: '1234',
        hostUserId: HOST,
        nowMs: 1000,
        commandId: 'create',
      }),
    );
    this.#stored = JSON.stringify(created);
    this.#expectFixedPoint();
  }

  peek(): PictionaryState {
    return parsePictionaryState(JSON.parse(this.#stored));
  }

  #expectFixedPoint(): void {
    expect(JSON.stringify(parsePictionaryState(JSON.parse(this.#stored)))).toBe(this.#stored);
  }

  #commandId(): string {
    this.#commandCounter += 1;
    return `round-trip-${this.#commandCounter}`;
  }

  user(userId: string, nowMs: number): CommandContext {
    return {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs,
      commandId: this.#commandId(),
      randomSeed: 'round-trip',
    };
  }

  /** The host acting for a bot seat (the client auto-submission shape). */
  hostForSeat(seat: number, nowMs: number): CommandContext {
    return {
      actor: { kind: 'user', userId: HOST },
      controlledSeat: seat,
      nowMs,
      commandId: this.#commandId(),
      randomSeed: 'round-trip',
    };
  }

  system(nowMs: number): CommandContext {
    return {
      actor: { kind: 'system', effectId: 'drawing-upload' },
      controlledSeat: null,
      nowMs,
      commandId: this.#commandId(),
      randomSeed: 'round-trip',
    };
  }

  /** Returns the rejection reason, or null when the command commits. */
  dispatch(input: PictionaryInput, context: CommandContext): string | null {
    let state: PictionaryState = pictionaryEngine.normalize(
      parsePictionaryState(JSON.parse(this.#stored)),
    );
    const decision = decidePictionaryInput(state, input, context);
    if (decision.kind === 'reject') {
      // persist() reject branch: the re-parsed state must serialize
      // back to the stored string byte for byte.
      expect(JSON.stringify(state)).toBe(this.#stored);
      return decision.reason;
    }
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
    if (decision.events.length > 0) {
      this.#stored = JSON.stringify(state);
    } else {
      // persist() also guards eventless commits against state drift.
      expect(JSON.stringify(state)).toBe(this.#stored);
    }
    this.#expectFixedPoint();
    return null;
  }

  /** Expires the current phase at its own deadline, as the worker's timer does. */
  expire(nowMs: number): void {
    const { deadlineAt, phaseRevision } = this.peek();
    if (deadlineAt === null) throw new Error('Expected a phase deadline to expire at');
    expect(
      this.dispatch(
        { type: 'pictionary.phase.expire', phaseRevision },
        this.user(HOST, Math.max(nowMs, deadlineAt)),
      ),
    ).toBeNull();
  }
}

function config(numberOfPlayers: number, guessDurationSeconds: 45 | 60 = 60): PictionaryConfig {
  return {
    numberOfPlayers,
    drawingDurationSeconds: 90,
    guessDurationSeconds,
    transitionDurationSeconds: 3,
    galleryItemDurationSeconds: 5,
  };
}

describe('Pictionary persistence round-trip', () => {
  it('keeps rejects phantom-free across the lobby opening sequence', () => {
    const room = new StoredRoom(config(6));

    // A reject before any commit: profile update from a user with no seat.
    expect(
      room.dispatch(
        { type: 'room.profile.update', profile: { displayName: 'Ghost' } },
        room.user('ghost', 1000),
      ),
    ).toBe(REASON_NOT_SEATED);

    // Seat takes: the host with a fully equipped profile, a joiner high.
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 0, profile: FULL_PROFILE },
        room.user(HOST, 1001),
      ),
    ).toBeNull();
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 5, profile: { displayName: 'P5' } },
        room.user('u1', 1002),
      ),
    ).toBeNull();

    // The shrink attempt: seat 5 is occupied beyond the target. This
    // reject is the regression's trigger shape — it runs against a
    // stored state that already carries the fully equipped profile.
    expect(
      room.dispatch({ type: 'pictionary.config.update', config: config(4) }, room.user(HOST, 1003)),
    ).toBe(REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE);

    // An invalid config (a duration outside the supported set) rejects too.
    expect(
      room.dispatch(
        {
          type: 'pictionary.config.update',
          config: { ...config(6), guessDurationSeconds: 17 as never },
        },
        room.user(HOST, 1004),
      ),
    ).toBe(REASON_PICTIONARY_CONFIG_INVALID);

    // A valid config change commits; the joiner moves inside the range.
    expect(
      room.dispatch(
        { type: 'pictionary.config.update', config: config(6, 45) },
        room.user(HOST, 1005),
      ),
    ).toBeNull();
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 2, profile: { displayName: 'P5' } },
        room.user('u1', 1006),
      ),
    ).toBeNull();

    // Profile updates land as the standalone event.
    expect(
      room.dispatch(
        { type: 'room.profile.update', profile: { displayName: 'Renamed' } },
        room.user(HOST, 1007),
      ),
    ).toBeNull();

    // Bots fill the room; a kicked bot seat is retaken by a human.
    expect(room.dispatch({ type: 'room.seat.fillBots' }, room.user(HOST, 1008))).toBeNull();
    expect(room.dispatch({ type: 'room.seat.kick', seat: 1 }, room.user(HOST, 1009))).toBeNull();
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 1, profile: { displayName: 'P1' } },
        room.user('u2', 1010),
      ),
    ).toBeNull();

    // Taking an occupied seat rejects against the full stored roster.
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 0, profile: { displayName: 'P0' } },
        room.user('u3', 1011),
      ),
    ).toBe('seat_taken');

    // The game begins; lobby commands now reject with the phase reason.
    expect(room.dispatch({ type: 'pictionary.game.begin' }, room.user(HOST, 1012))).toBeNull();
    expect(room.peek().phase).toBe('answering');
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 3, profile: { displayName: 'Late' } },
        room.user('u3', 1013),
      ),
    ).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('keeps the round subtrees inside the fixed point for a full round', () => {
    const room = new StoredRoom(config(4));
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 0, profile: FULL_PROFILE },
        room.user(HOST, 1001),
      ),
    ).toBeNull();
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 1, profile: { displayName: 'P1', level: 2 } },
        room.user('u1', 1002),
      ),
    ).toBeNull();
    expect(
      room.dispatch(
        { type: 'room.seat.take', seat: 2, profile: { displayName: 'P2' } },
        room.user('u2', 1003),
      ),
    ).toBeNull();
    expect(room.dispatch({ type: 'room.seat.fillBots' }, room.user(HOST, 1004))).toBeNull();

    // Begin: round.started freezes participants, seat order, offsets, chains.
    expect(room.dispatch({ type: 'pictionary.game.begin' }, room.user(HOST, 10_000))).toBeNull();
    expect(room.peek().phase).toBe('answering');

    // Submissions land in settling: the answering window only composes.
    // Step 0 (text): the deadline expires into settling, then everyone
    // submits; a duplicate submission rejects against the stored chains.
    room.expire(70_000);
    expect(room.peek().phase).toBe('settling');
    expect(
      room.dispatch({ type: 'pictionary.text.submit', text: '苹果' }, room.user(HOST, 71_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.text.submit', text: '香蕉' }, room.user('u1', 72_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.text.submit', text: '再来' }, room.user('u1', 72_500)),
    ).toBe(REASON_PICTIONARY_TASK_ALREADY_SUBMITTED);
    expect(
      room.dispatch({ type: 'pictionary.text.submit', text: '橙子' }, room.user('u2', 73_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.task.empty.submit' }, room.hostForSeat(BOT_SEAT, 74_000)),
    ).toBeNull();
    expect(room.peek().phase).toBe('transition');

    // Step 1 (drawing): readiness fills readySeats and settles the step,
    // then each seat reserves and commits its drawing upload.
    room.expire(77_000);
    expect(room.peek().phase).toBe('answering');
    for (const [seat, userId] of [
      [0, HOST],
      [1, 'u1'],
      [2, 'u2'],
    ] as const) {
      expect(
        room.dispatch(
          { type: 'pictionary.task.ready.set', isReady: true },
          room.user(userId, 80_000 + seat),
        ),
      ).toBeNull();
    }
    expect(
      room.dispatch(
        { type: 'pictionary.task.ready.set', isReady: true },
        room.hostForSeat(BOT_SEAT, 80_003),
      ),
    ).toBeNull();
    expect(room.peek().phase).toBe('settling');
    commitDrawings(room, 90_000);
    expect(room.peek().phase).toBe('transition');

    // Step 2 (text): expire into settling, everyone misses.
    room.expire(96_500);
    expect(room.peek().phase).toBe('answering');
    room.expire(156_500);
    expect(room.peek().phase).toBe('settling');
    for (const [seat, userId] of [
      [0, HOST],
      [1, 'u1'],
      [2, 'u2'],
    ] as const) {
      expect(
        room.dispatch({ type: 'pictionary.task.empty.submit' }, room.user(userId, 160_000 + seat)),
      ).toBeNull();
    }
    expect(
      room.dispatch({ type: 'pictionary.task.empty.submit' }, room.hostForSeat(BOT_SEAT, 160_003)),
    ).toBeNull();
    expect(room.peek().phase).toBe('transition');

    // Step 3 (drawing, final): expire into settling; drawings for two
    // seats, misses for the rest — the last entry completes the round.
    room.expire(163_003);
    expect(room.peek().phase).toBe('answering');
    room.expire(253_003);
    expect(room.peek().phase).toBe('settling');
    reserveAndCommit(room, 0, 260_000);
    reserveAndCommit(room, 1, 261_000);
    expect(
      room.dispatch({ type: 'pictionary.task.empty.submit' }, room.user('u2', 262_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.task.empty.submit' }, room.hostForSeat(BOT_SEAT, 263_000)),
    ).toBeNull();
    expect(room.peek().phase).toBe('transition');

    // The gallery is produced by the transition expiry; controls move it.
    room.expire(266_000);
    expect(room.peek().phase).toBe('gallery');
    expect(
      room.dispatch({ type: 'pictionary.gallery.advance' }, room.user(HOST, 267_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.gallery.pause' }, room.user(HOST, 268_000)),
    ).toBeNull();
    expect(
      room.dispatch({ type: 'pictionary.gallery.finish' }, room.user(HOST, 269_000)),
    ).toBeNull();
    expect(room.peek().phase).toBe('ended');

    // Back to the lobby; a final reject observes no phantom change.
    expect(
      room.dispatch({ type: 'pictionary.game.returnToLobby' }, room.user(HOST, 270_000)),
    ).toBeNull();
    expect(room.peek().phase).toBe('lobby');
    expect(
      room.dispatch(
        { type: 'room.profile.update', profile: { displayName: 'Ghost' } },
        room.user('ghost', 271_000),
      ),
    ).toBe(REASON_NOT_SEATED);
  });
});

/** Reserves and commits a drawing for every seat of the current step. */
function commitDrawings(room: StoredRoom, nowMs: number): void {
  for (let seat = 0; seat < 4; seat += 1) {
    reserveAndCommit(room, seat, nowMs + seat * 1000);
  }
}

/** Reserves a drawing for one seat and lands its upload commit. */
function reserveAndCommit(room: StoredRoom, seat: number, nowMs: number): void {
  const actor =
    seat === BOT_SEAT
      ? room.hostForSeat(BOT_SEAT, nowMs)
      : room.user(seat === 0 ? HOST : `u${seat}`, nowMs);
  expect(room.dispatch({ type: 'pictionary.drawing.reserve' }, actor)).toBeNull();
  const reservation = room.peek().reservations.find((item) => item.authorSeat === seat);
  if (reservation === undefined) throw new Error(`Missing reservation for seat ${seat}`);
  const commit: PictionaryInternalCommand = {
    type: 'pictionary.drawing.commit',
    submissionId: reservation.submissionId,
    media: {
      objectKey: `test/drawing-${seat}.png`,
      contentType: 'image/png',
      width: PICTIONARY_DRAWING_WIDTH,
      height: PICTIONARY_DRAWING_HEIGHT,
      byteLength: 1024,
      sha256: 'test-sha',
    },
  };
  expect(room.dispatch(commit, room.system(nowMs + 500))).toBeNull();
}

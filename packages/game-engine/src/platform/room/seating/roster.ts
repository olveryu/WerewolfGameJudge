/**
 * Unified room roster: one seat map whose slots hold a human, a bot, or
 * nothing. This is the single membership model for every game; per-game bot
 * lists, bot flags, and derived bot predicates are retired in its favour.
 *
 * Decisions compose the pure seating kernel over the human projection of
 * the roster, so every seat invariant (range, identity uniqueness,
 * stored-seat consistency) is enforced exactly once per decision. Bot
 * slots have no user identity: they occupy their seat exactly like a
 * human does, so a human can only take an empty seat; a bot seat is freed
 * by kicking the bot or clearing the room, never by sitting on it.
 */

import {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
} from './kernel';
import {
  SEAT_OPERATION_REASONS,
  type SeatChange,
  type SeatMap,
  type SeatOccupant,
  type SeatOperationResult,
} from './types';

/** A bot occupant: holds a seat, has no user identity. */
export interface BotSeatOccupant {
  readonly seat: number;
  readonly kind: 'bot';
}

export type RosterOccupant<TSeat extends SeatOccupant> = TSeat | BotSeatOccupant;

export type RosterMap<TSeat extends SeatOccupant> = Readonly<
  Record<number, RosterOccupant<TSeat> | null | undefined>
>;

export type RosterChange<TSeat extends SeatOccupant> = SeatChange<RosterOccupant<TSeat>>;

export type RosterOperationResult<TSeat extends SeatOccupant> = SeatOperationResult<
  RosterOccupant<TSeat>
>;

export function botSeatOccupant(seat: number): BotSeatOccupant {
  return { seat, kind: 'bot' };
}

export function isBotOccupant<TSeat extends SeatOccupant>(
  occupant: RosterOccupant<TSeat> | null | undefined,
): occupant is BotSeatOccupant {
  return occupant != null && 'kind' in occupant && occupant.kind === 'bot';
}

function assertSeatCount(seatCount: number): void {
  if (!Number.isSafeInteger(seatCount) || seatCount < 0) {
    throw new Error(`Roster invariant violated: invalid seatCount ${seatCount}`);
  }
}

function isSeatInRange(seat: number, seatCount: number): boolean {
  return Number.isSafeInteger(seat) && seat >= 0 && seat < seatCount;
}

/**
 * The human-only projection of a roster, in the kernel's seat-map shape.
 * Every roster invariant is validated here so a corrupt roster fails fast
 * in every decision path: keys in range, each occupant's stored seat
 * matching its key, and no userId occupying two seats.
 */
export function getHumanSeatMap<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
): SeatMap<TSeat> {
  assertSeatCount(seatCount);
  const humans: Record<number, TSeat> = {};
  const seatsByUserId = new Map<string, number>();
  for (const [rawSeat, occupant] of Object.entries(roster)) {
    if (occupant == null) continue;
    const seat = Number(rawSeat);
    if (!isSeatInRange(seat, seatCount) || occupant.seat !== seat) {
      throw new Error(
        `Roster invariant violated: occupant stores seat ${occupant.seat}, expected ${rawSeat} within ${seatCount} seats`,
      );
    }
    if (isBotOccupant(occupant)) continue;
    const existingSeat = seatsByUserId.get(occupant.userId);
    if (existingSeat !== undefined) {
      throw new Error(
        `Roster invariant violated: user ${occupant.userId} occupies seats ${existingSeat} and ${seat}`,
      );
    }
    seatsByUserId.set(occupant.userId, seat);
    humans[seat] = occupant;
  }
  return humans;
}

function botOccupantAt<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seat: number,
): BotSeatOccupant | null {
  const occupant = roster[seat];
  return isBotOccupant(occupant) ? occupant : null;
}

/** Seats currently held by bots, ascending. */
export function getBotSeats<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
): readonly number[] {
  return Object.entries(roster)
    .filter(([, occupant]) => isBotOccupant(occupant))
    .map(([rawSeat]) => Number(rawSeat))
    .sort((left, right) => left - right);
}

export function isBotSeat<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seat: number,
): boolean {
  return isBotOccupant(roster[seat]);
}

/** Total occupied seats (humans + bots). */
export function countOccupiedSeats<TSeat extends SeatOccupant>(roster: RosterMap<TSeat>): number {
  return Object.values(roster).filter((occupant) => occupant != null).length;
}

/** Whether any occupant (human or bot) sits at or beyond a seat count. */
export function hasOccupantAtOrBeyond<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
): boolean {
  return Object.entries(roster).some(
    ([rawSeat, occupant]) => occupant != null && Number(rawSeat) >= seatCount,
  );
}

/** A user's seat in the roster, or null when they hold no seat. */
export function findRosterSeatByUserId<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
  userId: string,
): number | null {
  return findSeatByUserId(getHumanSeatMap(roster, seatCount), seatCount, userId);
}

/**
 * Take a seat. Only an empty seat can be taken: a bot occupies its seat
 * like any player, so a bot seat rejects as seat_taken (free it by
 * kicking the bot or clearing first). Taking a seat while already
 * seated moves the user, as in the kernel.
 */
export function decideRosterTakeSeat<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
  targetSeat: number,
  userId: string,
  createOccupant: (seat: number) => TSeat,
): RosterOperationResult<TSeat> {
  const humans = getHumanSeatMap(roster, seatCount);
  if (!isSeatInRange(targetSeat, seatCount)) {
    return { kind: 'rejected', reason: SEAT_OPERATION_REASONS.invalidSeat };
  }
  if (isBotOccupant(roster[targetSeat])) {
    return { kind: 'rejected', reason: SEAT_OPERATION_REASONS.seatTaken };
  }
  return decideTakeSeat(humans, seatCount, targetSeat, userId, createOccupant);
}

/** Leave the seat held by a user. Bots have no identity and never leave. */
export function decideRosterLeaveSeat<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
  userId: string,
): RosterOperationResult<TSeat> {
  return decideLeaveSeat(getHumanSeatMap(roster, seatCount), seatCount, userId);
}

/** Kick whatever occupies a seat: a human or a bot. Empty seats reject. */
export function decideRosterKickSeat<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
  targetSeat: number,
): RosterOperationResult<TSeat> {
  const humans = getHumanSeatMap(roster, seatCount);
  const bot = botOccupantAt(roster, targetSeat);
  if (bot !== null) {
    if (!isSeatInRange(targetSeat, seatCount)) {
      return { kind: 'rejected', reason: SEAT_OPERATION_REASONS.invalidSeat };
    }
    return { kind: 'accepted', changes: [{ seat: targetSeat, previous: bot, next: null }] };
  }
  return decideKickSeat(humans, seatCount, targetSeat);
}

/** Clear every occupied seat, humans and bots alike. */
export function decideRosterClearSeats<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
): RosterOperationResult<TSeat> {
  const humanResult = decideClearSeats(getHumanSeatMap(roster, seatCount), seatCount);
  if (humanResult.kind === 'rejected') return humanResult;
  const botChanges: RosterChange<TSeat>[] = getBotSeats(roster).map((seat) => ({
    seat,
    previous: botSeatOccupant(seat),
    next: null,
  }));
  const changes = [...humanResult.changes, ...botChanges].sort(
    (left, right) => left.seat - right.seat,
  );
  return { kind: 'accepted', changes };
}

/** Fill every empty seat in range with a bot. Occupied seats are untouched. */
export function decideRosterFillBots<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seatCount: number,
): RosterOperationResult<TSeat> {
  assertSeatCount(seatCount);
  getHumanSeatMap(roster, seatCount);
  const changes: RosterChange<TSeat>[] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    if (roster[seat] == null) {
      changes.push({ seat, previous: null, next: botSeatOccupant(seat) });
    }
  }
  return { kind: 'accepted', changes };
}

/**
 * Apply decided roster changes, producing the next roster map. Events are
 * authoritative: a change's `next` wins for its seat, null empties it.
 */
export function applyRosterChanges<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  changes: readonly RosterChange<TSeat>[],
): RosterMap<TSeat> {
  const next: Record<number, RosterOccupant<TSeat>> = {};
  for (const [rawSeat, occupant] of Object.entries(roster)) {
    if (occupant != null) next[Number(rawSeat)] = occupant;
  }
  for (const change of changes) {
    if (change.next === null) {
      delete next[change.seat];
    } else {
      next[change.seat] = change.next;
    }
  }
  return next;
}

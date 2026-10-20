/**
 * Room Commands skeleton — direct branch-order tests (E-1).
 *
 * The skeleton is exercised through a minimal test game so the
 * welded gate order is pinned where it lives: profile ahead of the
 * lobby gate, lobby ahead of take/leave, take's display-name check
 * ahead of the roster decide, the host gate ahead of the config /
 * fill / kick / clear switch, and the config gates in
 * invalid → occupied → no-op → event order. Per-game behavior runs
 * through the shared scenarios (roomCommandsScenarios.ts).
 */

import { describe, expect, it } from 'vitest';

import { type CommandContext, commit, type Decision, reject } from '../../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';
import {
  decideRoomCommands,
  type DecideRoomCommandsOptions,
  type RoomCommandsCommand,
  type RoomConfigFacts,
  type RoomSeat,
  type SeatRosterFacts,
} from '../roomCommands';
import type { RoomProfileUpdate } from '../roster';
import { botSeatOccupant, type RosterChange, type RosterMap } from '../seating';

type TestEvent =
  | { readonly type: 'test.seats.changed'; readonly changes: readonly RosterChange<RoomSeat>[] }
  | { readonly type: 'test.config.updated'; readonly numberOfPlayers: number }
  | {
      readonly type: 'test.profile.updated';
      readonly seat: number;
      readonly profile: RoomProfileUpdate;
    };

interface TestConfigCommand {
  readonly type: 'test.config.update';
  readonly numberOfPlayers: number;
}

type TestDecision = Decision<TestEvent, never>;
type TestOptions = DecideRoomCommandsOptions<TestEvent, never, TestConfigCommand>;

const PHASE = 'test_phase';
const CONFIG = 'test_config';
const OCCUPIED = 'test_occupied';
const INVALID = 'test_config_invalid';

const human = (seat: number, userId: string, displayName = userId): RoomSeat => ({
  seat,
  userId,
  profile: { displayName },
});

const user = (userId: string, controlledSeat: number | null = null): CommandContext => ({
  actor: { kind: 'user', userId },
  controlledSeat,
  nowMs: 1000,
  commandId: 'room-commands-test',
  randomSeed: 'room-commands-test',
});

const system = (): CommandContext => ({
  actor: { kind: 'system', effectId: 'effect-1' },
  controlledSeat: null,
  nowMs: 1000,
  commandId: 'room-commands-test',
  randomSeed: 'room-commands-test',
});

function decide(
  command: RoomCommandsCommand<TestConfigCommand>,
  context: CommandContext,
  overrides: {
    readonly facts?: Partial<SeatRosterFacts>;
    readonly options?: Partial<TestOptions>;
  } = {},
): TestDecision {
  const facts: SeatRosterFacts = {
    roster: {},
    seatCount: 4,
    hostUserId: 'host',
    ...overrides.facts,
  };
  const options: TestOptions = {
    lobbyRejection: null,
    phaseReason: PHASE,
    configReason: CONFIG,
    occupiedReason: OCCUPIED,
    profileLanding: { kind: 'rosterChange' },
    resolveConfigFacts: (resolved) =>
      resolved.type === 'test.config.update'
        ? {
            invalidReason: resolved.numberOfPlayers < 2 ? INVALID : null,
            newSeatCount: resolved.numberOfPlayers,
            buildEvent: () => ({
              type: 'test.config.updated',
              numberOfPlayers: resolved.numberOfPlayers,
            }),
          }
        : null,
    buildSeatsChangedEvent: (changes) => ({ type: 'test.seats.changed', changes }),
    commit: (events) => commit({ events }),
    ...overrides.options,
  };
  return decideRoomCommands({ facts, command, context, options });
}

function expectReject(decision: TestDecision, reason: string): void {
  expect(decision).toEqual({ kind: 'reject', reason });
}

function expectCommit(decision: TestDecision): readonly TestEvent[] {
  expect(decision.kind).toBe('commit');
  if (decision.kind !== 'commit') throw new Error('expected a commit decision');
  return decision.events;
}

function expectEmptyCommit(decision: TestDecision): void {
  expect(decision.kind).toBe('commit');
  if (decision.kind !== 'commit') throw new Error('expected a commit decision');
  expect(decision.events).toEqual([]);
  expect(decision.broadcast).toBe('none');
}

const seatedRoster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 1: human(1, 'guest') };

describe('profile branch (ahead of the lobby gate)', () => {
  it('commits a merged roster change for the seated actor', () => {
    const events = expectCommit(
      decide({ type: 'room.profile.update', profile: { displayName: 'Hostess' } }, user('host'), {
        facts: { roster: seatedRoster },
      }),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [
          {
            seat: 0,
            previous: human(0, 'host'),
            next: human(0, 'host', 'Hostess'),
          },
        ],
      },
    ]);
  });

  it('runs even with a lobby rejection ready (profile precedes the lobby gate)', () => {
    const events = expectCommit(
      decide({ type: 'room.profile.update', profile: { displayName: 'New' } }, user('guest'), {
        facts: { roster: seatedRoster },
        options: { lobbyRejection: reject(PHASE) },
      }),
    );
    expect(events).toHaveLength(1);
  });

  it('rejects an unseated actor as not seated', () => {
    expectReject(
      decide({ type: 'room.profile.update', profile: { displayName: 'New' } }, user('nobody'), {
        facts: { roster: seatedRoster },
      }),
      REASON_NOT_SEATED,
    );
  });

  it('rejects a system actor and a controlled-seat actor with the platform codes', () => {
    const command = { type: 'room.profile.update', profile: { displayName: 'New' } } as const;
    expectReject(
      decide(command, system(), { facts: { roster: seatedRoster } }),
      REASON_USER_ACTOR_REQUIRED,
    );
    expectReject(
      decide(command, user('host', 1), { facts: { roster: seatedRoster } }),
      REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    );
  });

  it('rejects a blank display name with the game config reason, after seat resolution', () => {
    expectReject(
      decide({ type: 'room.profile.update', profile: { displayName: '   ' } }, user('guest'), {
        facts: { roster: seatedRoster },
      }),
      CONFIG,
    );
    // Seat resolution comes first: an unseated actor hears not-seated, not config.
    expectReject(
      decide({ type: 'room.profile.update', profile: { displayName: '' } }, user('nobody'), {
        facts: { roster: seatedRoster },
      }),
      REASON_NOT_SEATED,
    );
  });

  it('accepts a partial update that carries no display name', () => {
    const events = expectCommit(
      decide({ type: 'room.profile.update', profile: { avatarUrl: 'a.png' } }, user('guest'), {
        facts: { roster: seatedRoster },
      }),
    );
    expect(events).toHaveLength(1);
  });

  it('lands through the game profile event when the landing is event-shaped', () => {
    const events = expectCommit(
      decide({ type: 'room.profile.update', profile: { displayName: 'New' } }, user('guest'), {
        facts: { roster: seatedRoster },
        options: {
          profileLanding: {
            kind: 'event',
            buildEvent: (seat, profile) => ({ type: 'test.profile.updated', seat, profile }),
          },
        },
      }),
    );
    expect(events).toEqual([
      { type: 'test.profile.updated', seat: 1, profile: { displayName: 'New' } },
    ]);
  });
});

describe('lobby gate and take/leave branch', () => {
  it('returns the ready-made lobby rejection for seat commands outside the lobby', () => {
    expectReject(
      decide({ type: 'room.seat.take', seat: 2, profile: { displayName: 'X' } }, user('x'), {
        options: { lobbyRejection: reject(PHASE) },
      }),
      PHASE,
    );
  });

  it('takes an empty seat with an occupant built by the skeleton', () => {
    const events = expectCommit(
      decide({ type: 'room.seat.take', seat: 2, profile: { displayName: 'New' } }, user('new')),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [{ seat: 2, previous: null, next: human(2, 'new', 'New') }],
      },
    ]);
  });

  it('moves a seated user who takes another seat', () => {
    const events = expectCommit(
      decide(
        { type: 'room.seat.take', seat: 3, profile: { displayName: 'Guest' } },
        user('guest'),
        { facts: { roster: seatedRoster } },
      ),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [
          { seat: 1, previous: human(1, 'guest'), next: null },
          { seat: 3, previous: null, next: human(3, 'guest', 'Guest') },
        ],
      },
    ]);
  });

  it('validates the take display name ahead of the roster decide', () => {
    // Seat 0 is occupied: an empty name must hear config, not seat_taken.
    expectReject(
      decide({ type: 'room.seat.take', seat: 0, profile: { displayName: ' ' } }, user('new'), {
        facts: { roster: seatedRoster },
      }),
      CONFIG,
    );
  });

  it('passes roster rejections through untouched', () => {
    expectReject(
      decide({ type: 'room.seat.take', seat: 0, profile: { displayName: 'New' } }, user('new'), {
        facts: { roster: seatedRoster },
      }),
      'seat_taken',
    );
    expectReject(
      decide({ type: 'room.seat.take', seat: 9, profile: { displayName: 'New' } }, user('new')),
      'invalid_seat',
    );
    expectReject(decide({ type: 'room.seat.leave' }, user('nobody')), 'not_seated');
  });

  it('leaves the seat the actor holds', () => {
    const events = expectCommit(
      decide({ type: 'room.seat.leave' }, user('guest'), { facts: { roster: seatedRoster } }),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [{ seat: 1, previous: human(1, 'guest'), next: null }],
      },
    ]);
  });

  it('rejects a controlled-seat actor on take with the platform code', () => {
    expectReject(
      decide({ type: 'room.seat.take', seat: 2, profile: { displayName: 'X' } }, user('host', 0)),
      REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    );
  });
});

describe('host gate and the host switch', () => {
  it('runs the lobby gate ahead of the host gate', () => {
    expectReject(
      decide({ type: 'room.seat.fillBots' }, user('guest'), {
        options: { lobbyRejection: reject(PHASE) },
      }),
      PHASE,
    );
  });

  it('rejects a non-host with the platform not-host code', () => {
    expectReject(decide({ type: 'room.seat.fillBots' }, user('guest')), REASON_NOT_HOST);
    expectReject(decide({ type: 'room.seat.kick', seat: 0 }, user('guest')), REASON_NOT_HOST);
    expectReject(decide({ type: 'room.seat.clear' }, user('guest')), REASON_NOT_HOST);
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('guest')),
      REASON_NOT_HOST,
    );
  });

  it('passes controlled-seat and system actors through the host gate with platform codes', () => {
    expectReject(
      decide({ type: 'room.seat.fillBots' }, user('host', 1)),
      REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    );
    expectReject(decide({ type: 'room.seat.fillBots' }, system()), REASON_USER_ACTOR_REQUIRED);
  });

  it('fills every empty seat with bots, and commits empty on a full room', () => {
    const events = expectCommit(
      decide({ type: 'room.seat.fillBots' }, user('host'), { facts: { roster: seatedRoster } }),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [
          { seat: 2, previous: null, next: botSeatOccupant(2) },
          { seat: 3, previous: null, next: botSeatOccupant(3) },
        ],
      },
    ]);
    expectEmptyCommit(
      decide({ type: 'room.seat.fillBots' }, user('host'), {
        facts: {
          roster: {
            0: human(0, 'host'),
            1: human(1, 'guest'),
            2: botSeatOccupant(2),
            3: botSeatOccupant(3),
          },
        },
      }),
    );
  });

  it('kicks humans and bots alike, and passes seat_empty through', () => {
    const roster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 1: botSeatOccupant(1) };
    expect(
      expectCommit(
        decide({ type: 'room.seat.kick', seat: 1 }, user('host'), { facts: { roster } }),
      ),
    ).toEqual([
      {
        type: 'test.seats.changed',
        changes: [{ seat: 1, previous: botSeatOccupant(1), next: null }],
      },
    ]);
    expectReject(
      decide({ type: 'room.seat.kick', seat: 3 }, user('host'), { facts: { roster } }),
      'seat_empty',
    );
  });

  it('clears every occupied seat, and commits empty on an empty room', () => {
    const events = expectCommit(
      decide({ type: 'room.seat.clear' }, user('host'), { facts: { roster: seatedRoster } }),
    );
    expect(events).toEqual([
      {
        type: 'test.seats.changed',
        changes: [
          { seat: 0, previous: human(0, 'host'), next: null },
          { seat: 1, previous: human(1, 'guest'), next: null },
        ],
      },
    ]);
    expectEmptyCommit(decide({ type: 'room.seat.clear' }, user('host')));
  });
});

describe('config branch (invalid → occupied → no-op → event)', () => {
  it('rejects an invalid config with the facts invalid reason', () => {
    expectReject(decide({ type: 'test.config.update', numberOfPlayers: 1 }, user('host')), INVALID);
  });

  it('runs invalid ahead of occupied', () => {
    // Seat 3 is occupied; shrinking to 1 is both invalid and stranding.
    const roster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 3: human(3, 'guest') };
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 1 }, user('host'), {
        facts: { roster },
      }),
      INVALID,
    );
  });

  it('rejects a valid config that strands an occupant with the occupied reason', () => {
    const roster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 3: human(3, 'guest') };
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host'), {
        facts: { roster },
      }),
      OCCUPIED,
    );
  });

  it('commits the config event for a valid, unstranding update', () => {
    const events = expectCommit(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host')),
    );
    expect(events).toEqual([{ type: 'test.config.updated', numberOfPlayers: 3 }]);
  });

  it('commits empty for a no-op config, after the occupied gate', () => {
    const noopFacts = (resolved: TestConfigCommand): RoomConfigFacts<TestEvent> => ({
      invalidReason: null,
      newSeatCount: resolved.numberOfPlayers,
      isNoop: resolved.numberOfPlayers === 4,
      buildEvent: () => ({
        type: 'test.config.updated',
        numberOfPlayers: resolved.numberOfPlayers,
      }),
    });
    const options: Partial<TestOptions> = {
      resolveConfigFacts: (resolved) =>
        resolved.type === 'test.config.update' ? noopFacts(resolved) : null,
    };
    expectEmptyCommit(
      decide({ type: 'test.config.update', numberOfPlayers: 4 }, user('host'), {
        options,
      }),
    );
    // The occupied gate still runs first: a stranding no-op-shaped update rejects.
    const roster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 3: human(3, 'guest') };
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host'), {
        facts: { roster },
        options: {
          resolveConfigFacts: (resolved) =>
            resolved.type === 'test.config.update'
              ? { ...noopFacts(resolved), isNoop: true }
              : null,
        },
      }),
      OCCUPIED,
    );
  });

  it('skips the occupied gate when the facts carry no seat count', () => {
    const roster: RosterMap<RoomSeat> = { 0: human(0, 'host'), 3: human(3, 'guest') };
    const events = expectCommit(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host'), {
        facts: { roster },
        options: {
          resolveConfigFacts: (resolved) =>
            resolved.type === 'test.config.update'
              ? {
                  invalidReason: null,
                  buildEvent: () => ({
                    type: 'test.config.updated',
                    numberOfPlayers: resolved.numberOfPlayers,
                  }),
                }
              : null,
        },
      }),
    );
    expect(events).toEqual([{ type: 'test.config.updated', numberOfPlayers: 3 }]);
  });

  it('rejects a config-shaped command with the phase reason when no resolver is provided', () => {
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host'), {
        options: { resolveConfigFacts: undefined },
      }),
      PHASE,
    );
  });

  it('rejects with the phase reason when the resolver resolves no facts', () => {
    expectReject(
      decide({ type: 'test.config.update', numberOfPlayers: 3 }, user('host'), {
        options: { resolveConfigFacts: () => null },
      }),
      PHASE,
    );
  });

  it('rejects an unknown command with the phase reason after the host gate', () => {
    expectReject(
      decide({ type: 'test.game.start' } as unknown as TestConfigCommand, user('host')),
      PHASE,
    );
    expectReject(
      decide({ type: 'test.game.start' } as unknown as TestConfigCommand, user('guest')),
      REASON_NOT_HOST,
    );
  });
});

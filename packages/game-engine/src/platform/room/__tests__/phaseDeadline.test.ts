/**
 * Phase Deadline chassis — direct unit tests for the guard
 * sequence, the settle.due constructor and the late-submission
 * gate (E-2). Per-game wiring is pinned by each game's
 * `phaseDeadlineProtocol.contract.test.ts` running the shared
 * scenarios; this file pins the chassis dimensions themselves:
 * gate order, actor channels, the multi-check revision gate, the
 * deadline boundary.
 */

import { describe, expect, it } from 'vitest';

import {
  type CommandContext,
  commit,
  type Decision,
  type GameEffect,
  type GameEvent,
  reject,
} from '../../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';
import {
  buildSettleDueEffect,
  guardPhaseExpiry,
  type PhaseExpiryGuards,
  rejectIfPastDeadline,
} from '../phaseDeadline';

interface TestEvent extends GameEvent {
  readonly type: 'test.expired';
}

const DEADLINE = 5000;
const NOT_EXPIRED = 'test_not_expired';

function user(userId = 'user-1', controlledSeat: number | null = null, nowMs = DEADLINE) {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    commandId: 'command-1',
    randomSeed: 'phase-deadline-test',
    nowMs,
  } satisfies CommandContext;
}

function system(nowMs = DEADLINE) {
  return {
    actor: { kind: 'system', effectId: 'effect-1' },
    controlledSeat: null,
    commandId: 'command-1',
    randomSeed: 'phase-deadline-test',
    nowMs,
  } satisfies CommandContext;
}

function guards(
  overrides: Partial<PhaseExpiryGuards<TestEvent, GameEffect>> = {},
): PhaseExpiryGuards<TestEvent, GameEffect> {
  return {
    deadlineAt: DEADLINE,
    notExpiredReason: NOT_EXPIRED,
    dispatch: () => commit<TestEvent, GameEffect>({ events: [{ type: 'test.expired' }] }),
    ...overrides,
  };
}

describe('guardPhaseExpiry gate order', () => {
  it('returns the ready-made phase rejection before any other gate', () => {
    const decision = guardPhaseExpiry(
      user('user-1', 2, DEADLINE - 1),
      guards({ phaseRejection: reject('test_wrong_phase') }),
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'test_wrong_phase' });
  });

  it('resolves the actor before the per-game actor gate', () => {
    let checkActorCalled = false;
    const decision = guardPhaseExpiry(
      user('user-1', 2),
      guards({
        checkActor: () => {
          checkActorCalled = true;
          return null;
        },
      }),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED });
    expect(checkActorCalled).toBe(false);
  });

  it('runs the actor gate before the revision gate', () => {
    const decision = guardPhaseExpiry(
      user(),
      guards({
        checkActor: () => reject('test_actor_gate'),
        revision: {
          checks: [{ commandRevision: 1, currentRevision: 2 }],
          onStale: () => reject('test_stale'),
        },
      }),
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'test_actor_gate' });
  });

  it('runs the revision gate before the deadline gate', () => {
    const decision = guardPhaseExpiry(
      user('user-1', null, DEADLINE - 1),
      guards({
        revision: {
          checks: [{ commandRevision: 1, currentRevision: 2 }],
          onStale: () => reject('test_stale'),
        },
      }),
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'test_stale' });
  });
});

describe('guardPhaseExpiry actor channels', () => {
  it('defaults to the uncontrolled-user channel: the system actor rejects', () => {
    expect(guardPhaseExpiry(system(), guards())).toEqual({
      kind: 'reject',
      reason: REASON_USER_ACTOR_REQUIRED,
    });
  });

  it('passes the resolved user id to the actor gate', () => {
    const seen: string[] = [];
    const decision = guardPhaseExpiry(
      user('user-7'),
      guards({
        checkActor: (actorId) => {
          seen.push(actorId);
          return null;
        },
      }),
    );
    expect(decision.kind).toBe('commit');
    expect(seen).toEqual(['user-7']);
  });

  it('on the system channel resolves the effect id and rejects user actors', () => {
    const seen: string[] = [];
    const decision = guardPhaseExpiry(
      system(),
      guards({
        actorChannel: 'system',
        checkActor: (actorId) => {
          seen.push(actorId);
          return null;
        },
      }),
    );
    expect(decision.kind).toBe('commit');
    expect(seen).toEqual(['effect-1']);
    expect(guardPhaseExpiry(user(), guards({ actorChannel: 'system' }))).toEqual({
      kind: 'reject',
      reason: REASON_SYSTEM_ACTOR_REQUIRED,
    });
  });
});

describe('guardPhaseExpiry revision gate', () => {
  it('dispatches when every check matches', () => {
    const decision = guardPhaseExpiry(
      user(),
      guards({
        revision: {
          checks: [
            { commandRevision: 3, currentRevision: 3 },
            { commandRevision: 7, currentRevision: 7 },
          ],
          onStale: () => reject('test_stale'),
        },
      }),
    );
    expect(decision.kind).toBe('commit');
  });

  it('treats any single mismatched check as stale', () => {
    const decision = guardPhaseExpiry(
      user(),
      guards({
        revision: {
          checks: [
            { commandRevision: 3, currentRevision: 3 },
            { commandRevision: 7, currentRevision: 8 },
          ],
          onStale: () => commit<TestEvent, GameEffect>({ events: [] }),
        },
      }),
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') expect(decision.events).toEqual([]);
  });
});

describe('guardPhaseExpiry deadline gate', () => {
  it('rejects a missing deadline with the injected reason', () => {
    expect(guardPhaseExpiry(user(), guards({ deadlineAt: null }))).toEqual({
      kind: 'reject',
      reason: NOT_EXPIRED,
    });
  });

  it('rejects before the deadline and dispatches at it, handing dispatch the command time', () => {
    const seen: number[] = [];
    const atDeadline = guards({
      dispatch: (nowMs) => {
        seen.push(nowMs);
        return commit<TestEvent, GameEffect>({ events: [{ type: 'test.expired' }] });
      },
    });
    expect(guardPhaseExpiry(user('user-1', null, DEADLINE - 1), atDeadline)).toEqual({
      kind: 'reject',
      reason: NOT_EXPIRED,
    });
    expect(guardPhaseExpiry(user(), atDeadline).kind).toBe('commit');
    expect(seen).toEqual([DEADLINE]);
  });
});

describe('buildSettleDueEffect', () => {
  it('builds the bare pin (game sequence and deadline only)', () => {
    expect(buildSettleDueEffect('demo', { gameSequence: 4, deadlineAt: 61000 })).toEqual({
      type: 'demo.settle.due',
      payload: { gameSequence: 4, deadlineAt: 61000 },
    });
  });

  it('carries the extended phase identity pins untouched', () => {
    expect(
      buildSettleDueEffect('avalon', {
        gameSequence: 2,
        phase: 'vote',
        round: 3,
        deadlineAt: 9000,
      }),
    ).toEqual({
      type: 'avalon.settle.due',
      payload: { gameSequence: 2, phase: 'vote', round: 3, deadlineAt: 9000 },
    });
  });
});

describe('rejectIfPastDeadline', () => {
  it('lets submissions through with no deadline armed or before it', () => {
    expect(rejectIfPastDeadline(null, DEADLINE, 'late')).toBeNull();
    expect(rejectIfPastDeadline(DEADLINE, DEADLINE - 1, 'late')).toBeNull();
  });

  it('rejects at and after the deadline with the given reason', () => {
    const at: Decision<GameEvent, GameEffect> | null = rejectIfPastDeadline(
      DEADLINE,
      DEADLINE,
      'late',
    );
    expect(at).toEqual({ kind: 'reject', reason: 'late' });
    expect(rejectIfPastDeadline(DEADLINE, DEADLINE + 1, 'late')).toEqual({
      kind: 'reject',
      reason: 'late',
    });
  });
});

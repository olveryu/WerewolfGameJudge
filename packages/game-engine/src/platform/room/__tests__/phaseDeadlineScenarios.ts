/**
 * Phase Deadline Protocol — shared scenario suite (E-2).
 *
 * Every game with a stage deadline runs these exact scenarios
 * against its own engine through a small driver, so the expiry
 * guard semantics (gate order, channel discipline, the registered
 * stale policy, the deadline boundary) cannot drift per game. The
 * guard's own dimensions are pinned directly in
 * `phaseDeadline.test.ts`; this suite pins the behavior through
 * each game's real commands and state machine. Game-specific
 * behavior (what expiry dispatches into, gallery flows) stays in
 * each game's own suites.
 *
 * The driver's session starts in an armed phase (a deadline is
 * set). Expiry is attempted through the game's own commands,
 * exactly as its clients and the Worker submit them.
 */

import { describe, expect, it } from 'vitest';

import type { Decision, GameEffect, GameEvent } from '../../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_SYSTEM_ACTOR_REQUIRED,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';

/** What the suite expects each registered gate to answer with. */
export interface PhaseDeadlineExpectations {
  /** This game's reason for a missing or unreached deadline. */
  readonly notExpiredReason: string;
  /**
   * The public expire command's actor channel: 'uncontrolledUser',
   * or null when the game has no public expire command at all (its
   * scheduled settle effect is the only channel).
   */
  readonly publicChannel: 'uncontrolledUser' | null;
  /** Whether the game also carries an internal settle command. */
  readonly hasSettleCommand: boolean;
  /**
   * The registered stale-revision policy for the expire command:
   * 'silent' commits empty, 'reject' rejects (at the guard or at
   * the game's decide entry — the observable outcome is the same
   * rejection), 'none' means the expire command carries no revision.
   */
  readonly stalePolicy: 'silent' | 'reject' | 'none';
  /** Rejection reason when stalePolicy is 'reject'. */
  readonly staleReason: string | null;
  /** Whether dispatching the expiry advances the game observably. */
  readonly dispatchAdvances: boolean;
}

/** One armed-phase session, driven through the game's own commands. */
export interface PhaseDeadlineSession {
  /** Public expire command as an ordinary uncontrolled user. */
  expireAsUser(nowMs: number): Decision<GameEvent, GameEffect>;
  /** Public expire command as a user controlling a (bot) seat. */
  expireAsControlledUser(nowMs: number): Decision<GameEvent, GameEffect>;
  /** Public expire command as the system actor. */
  expirePublicAsSystem(nowMs: number): Decision<GameEvent, GameEffect>;
  /** Internal settle command as the system actor. */
  expireSettleAsSystem(nowMs: number): Decision<GameEvent, GameEffect>;
  /** Internal settle command as a user actor. */
  expireSettleAsUser(nowMs: number): Decision<GameEvent, GameEffect>;
  /**
   * The game's primary expiry surface carrying a revision that is
   * not the current one. Only meaningful when stalePolicy is not
   * 'none'.
   */
  expireWithStaleRevision(nowMs: number): Decision<GameEvent, GameEffect>;
  /** The armed deadline of the session's current phase. */
  deadlineAt(): number;
  /** Whether the game has observably advanced past the armed phase. */
  hasAdvanced(): boolean;
}

export interface PhaseDeadlineSuite {
  /** Display name for the describe block. */
  readonly game: string;
  /** A fresh session in an armed phase, nobody expired yet. */
  makeSession(): PhaseDeadlineSession;
  readonly expectations: PhaseDeadlineExpectations;
}

export function describePhaseDeadlineProtocol(suite: PhaseDeadlineSuite): void {
  const { expectations } = suite;
  /** Expiry through the game's primary surface with a valid actor. */
  const expirePrimary = (session: PhaseDeadlineSession, nowMs: number) =>
    expectations.publicChannel === 'uncontrolledUser'
      ? session.expireAsUser(nowMs)
      : session.expireSettleAsSystem(nowMs);

  describe(`Phase Deadline Protocol - shared scenarios (${suite.game})`, () => {
    it('rejects expiry before the deadline with the registered reason', () => {
      const session = suite.makeSession();
      const decision = expirePrimary(session, session.deadlineAt() - 1);
      expect(decision).toEqual({ kind: 'reject', reason: expectations.notExpiredReason });
      expect(session.hasAdvanced()).toBe(false);
    });

    it('dispatches the expiry at the deadline', () => {
      const session = suite.makeSession();
      const decision = expirePrimary(session, session.deadlineAt());
      expect(decision.kind).toBe('commit');
      expect(session.hasAdvanced()).toBe(expectations.dispatchAdvances);
    });

    if (expectations.publicChannel === 'uncontrolledUser') {
      it('rejects a controlled-seat actor ahead of the deadline gate', () => {
        const session = suite.makeSession();
        const decision = session.expireAsControlledUser(session.deadlineAt() - 1);
        expect(decision).toEqual({
          kind: 'reject',
          reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
        });
        expect(session.hasAdvanced()).toBe(false);
      });

      it('rejects the system actor on the public expire command', () => {
        const session = suite.makeSession();
        const decision = session.expirePublicAsSystem(session.deadlineAt());
        expect(decision).toEqual({ kind: 'reject', reason: REASON_USER_ACTOR_REQUIRED });
        expect(session.hasAdvanced()).toBe(false);
      });
    }

    if (expectations.hasSettleCommand) {
      it('rejects a user actor on the internal settle command', () => {
        const session = suite.makeSession();
        const decision = session.expireSettleAsUser(session.deadlineAt());
        expect(decision).toEqual({ kind: 'reject', reason: REASON_SYSTEM_ACTOR_REQUIRED });
        expect(session.hasAdvanced()).toBe(false);
      });

      it('dispatches the internal settle at the deadline', () => {
        const session = suite.makeSession();
        const decision = session.expireSettleAsSystem(session.deadlineAt());
        expect(decision.kind).toBe('commit');
        expect(session.hasAdvanced()).toBe(expectations.dispatchAdvances);
      });
    }

    if (expectations.stalePolicy === 'silent') {
      it('silently commits empty on a stale revision', () => {
        const session = suite.makeSession();
        const decision = session.expireWithStaleRevision(session.deadlineAt());
        expect(decision.kind).toBe('commit');
        if (decision.kind === 'commit') expect(decision.events).toEqual([]);
        expect(session.hasAdvanced()).toBe(false);
      });
    }

    if (expectations.stalePolicy === 'reject') {
      it('rejects a stale revision instead of expiring', () => {
        const session = suite.makeSession();
        const decision = session.expireWithStaleRevision(session.deadlineAt());
        expect(decision).toEqual({ kind: 'reject', reason: expectations.staleReason });
        expect(session.hasAdvanced()).toBe(false);
      });
    }
  });
}

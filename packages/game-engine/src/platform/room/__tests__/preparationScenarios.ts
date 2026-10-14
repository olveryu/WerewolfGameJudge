/**
 * Word Preparation Protocol — shared scenario suite (P1).
 *
 * Every game that prepares rounds by selecting a word off-band
 * (FibKing, Undercover) runs these exact scenarios against its own
 * engine through a small driver, so the protocol propositions cannot
 * drift per game:
 *
 * 1. start rejects while the room is not full, and a duplicate start
 *    rejects while a round is already preparing;
 * 2. entering preparing emits exactly one selection effect, whose
 *    payload carries the roundId and a snapshot of the used set;
 * 3. complete / fail accept only the system actor, and a roundId
 *    that does not match the pending round always rejects;
 * 4. after a fail, completing the same round rejects; a retry then
 *    follows the game's injected identity strategy (D-1), and a
 *    completed round records its word in the used set;
 * 5. the runtime fallback synthesizes a `selectionFailed` failure
 *    command only while the selection's round is still preparing.
 *
 * Game-specific behavior (FibKing's stage gates, Undercover's word
 * validation) stays in each game's own test files.
 */

import { describe, expect, it } from 'vitest';

import { REASON_SYSTEM_ACTOR_REQUIRED } from '../../protocol/reasons';
import type { PreparationRetryStrategy } from '../preparation';

/** A decision reduced to what the protocol propositions assert on. */
export interface PreparationDecisionProbe {
  readonly kind: 'commit' | 'reject';
  readonly reason: string | null;
  /** Selection effects carried by the decision (preparation entry emits exactly one). */
  readonly selectionEffects: readonly {
    readonly roundId: string;
    readonly usedSnapshot: readonly string[];
  }[];
}

/** One live session of a preparation game, driven through the game's own commands. */
export interface PreparationSession {
  /** The game's current phase name. */
  phase(): string;
  /** The pending round's id (the failed round's id while in preparationFailed). */
  pendingRoundId(): string | null;
  /** The pending round's request time (the failed round's, while failed). */
  pendingRequestedAt(): number | null;
  /** The state's used set: words for FibKing, word-pair ids for Undercover. */
  usedSet(): readonly string[];
  /** The used-set key the session's valid completion carries. */
  selectedKey(): string;
  /** Probe the host start decision without applying it. */
  startDecision(): PreparationDecisionProbe;
  /** Apply the host start decision (must commit). */
  applyStart(): void;
  /** Probe a complete decision for the given actor kind and roundId. */
  completeDecision(actorKind: 'system' | 'user', roundId: string): PreparationDecisionProbe;
  /** Probe a fail decision for the given actor kind, roundId and failure code. */
  failDecision(
    actorKind: 'system' | 'user',
    roundId: string,
    failureCode: string,
  ): PreparationDecisionProbe;
  /** Apply a system fail with the given failure code (must commit). */
  applyFail(failureCode: string): void;
  /** Apply a valid system completion of the pending round (must commit). */
  applyComplete(): void;
  /** Retry the failed preparation through the game's own retry entry. */
  retryPreparation(): void;
  /** The protocol runtime fallback command for the session's selection effect. */
  failureCommand(): { readonly roundId: string; readonly failureCode: string } | null;
}

export interface PreparationSuite {
  /** Display name for the describe block. */
  readonly game: string;
  /** The retry identity strategy the game injects (D-1). */
  readonly retryStrategy: PreparationRetryStrategy;
  readonly notFullReason: string;
  readonly alreadyPreparingReason: string;
  readonly notPreparingReason: string;
  readonly roundMismatchReason: string;
  /** A fresh lobby session; `full` fills every seat. */
  makeSession(full: boolean): PreparationSession;
}

export function describeWordPreparationProtocol(suite: PreparationSuite): void {
  describe(`Word Preparation Protocol - shared scenarios (${suite.game})`, () => {
    it('rejects start while the room is not full', () => {
      const session = suite.makeSession(false);
      const decision = session.startDecision();
      expect(decision.kind).toBe('reject');
      expect(decision.reason).toBe(suite.notFullReason);
      expect(decision.selectionEffects).toEqual([]);
    });

    it('emits exactly one selection effect carrying roundId and the used-set snapshot', () => {
      const session = suite.makeSession(true);
      const usedBefore = [...session.usedSet()];
      const decision = session.startDecision();
      expect(decision.kind).toBe('commit');
      expect(decision.selectionEffects).toHaveLength(1);
      const effect = decision.selectionEffects[0]!;
      expect(effect.usedSnapshot).toEqual(usedBefore);
      session.applyStart();
      expect(session.phase()).toBe('preparing');
      expect(effect.roundId).toBe(session.pendingRoundId());
    });

    it('rejects a duplicate start while preparing', () => {
      const session = suite.makeSession(true);
      session.applyStart();
      const decision = session.startDecision();
      expect(decision.kind).toBe('reject');
      expect(decision.reason).toBe(suite.alreadyPreparingReason);
    });

    it('accepts complete and fail only from the system actor, with a matching roundId', () => {
      const session = suite.makeSession(true);
      session.applyStart();
      const roundId = session.pendingRoundId()!;

      for (const probe of [
        session.completeDecision('user', roundId),
        session.failDecision('user', roundId, 'inventoryExhausted'),
      ]) {
        expect(probe.kind).toBe('reject');
        expect(probe.reason).toBe(REASON_SYSTEM_ACTOR_REQUIRED);
      }
      for (const probe of [
        session.completeDecision('system', 'round-that-does-not-exist'),
        session.failDecision('system', 'round-that-does-not-exist', 'inventoryExhausted'),
      ]) {
        expect(probe.kind).toBe('reject');
        expect(probe.reason).toBe(suite.roundMismatchReason);
      }
      expect(session.phase()).toBe('preparing');
    });

    it('fails into preparationFailed, rejects its completion, retries per strategy, then records the word', () => {
      const session = suite.makeSession(true);
      session.applyStart();
      const roundId = session.pendingRoundId()!;
      const requestedAt = session.pendingRequestedAt()!;

      session.applyFail('inventoryExhausted');
      expect(session.phase()).toBe('preparationFailed');

      const lateComplete = session.completeDecision('system', roundId);
      expect(lateComplete.kind).toBe('reject');
      expect(lateComplete.reason).toBe(suite.notPreparingReason);

      session.retryPreparation();
      expect(session.phase()).toBe('preparing');
      if (suite.retryStrategy === 'reuse') {
        // D-1 reuse: the failed pending round is replayed unchanged.
        expect(session.pendingRoundId()).toBe(roundId);
        expect(session.pendingRequestedAt()).toBe(requestedAt);
      } else {
        // D-1 fresh: a brand new pending round replaces the failed one.
        expect(session.pendingRoundId()).not.toBe(roundId);
      }

      session.applyComplete();
      expect(session.usedSet()).toContain(session.selectedKey());
    });

    it('synthesizes a selectionFailed fallback only while the round is still preparing', () => {
      const session = suite.makeSession(true);
      session.applyStart();
      expect(session.failureCommand()).toEqual({
        roundId: session.pendingRoundId(),
        failureCode: 'selectionFailed',
      });
      session.applyFail('inventoryExhausted');
      expect(session.failureCommand()).toBe(null);
    });
  });
}

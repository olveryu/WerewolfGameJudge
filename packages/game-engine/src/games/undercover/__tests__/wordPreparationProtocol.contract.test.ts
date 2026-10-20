/**
 * Word Preparation Protocol — Undercover contract scenarios (P1).
 *
 * Runs the shared preparation propositions against the real
 * Undercover engine. Undercover injections: the empty stage
 * vocabulary (no stage gate on completion), the full three-code
 * failure superset as its declared subset (D-2), and the `reuse`
 * retry strategy (D-1): the dedicated retry command replays the
 * failed pending round unchanged.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  describeWordPreparationProtocol,
  type PreparationDecisionProbe,
  type PreparationSession,
} from '../../../platform/room/__tests__/preparationScenarios';
import { buildPreparationFailureCommand } from '../../../platform/room/preparation';
import type { UndercoverCommand } from '../commands/types';
import { UNDERCOVER_REASONS, type UndercoverDecision } from '../domain/decision';
import type { UndercoverEffect } from '../domain/events';
import { undercoverEngine } from '../engine';
import type { UndercoverPreparationFailure, UndercoverState } from '../state/types';

const WORD_PAIR = { id: 'pair-1', wordA: 'Milk', wordB: 'Soy milk', category: 'food' } as const;

function hostContext(commandId: string): CommandContext {
  return {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    commandId,
    randomSeed: 'preparation-protocol',
    nowMs: 1000,
  };
}

function systemContext(commandId: string): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'word-selection' },
    controlledSeat: null,
    commandId,
    randomSeed: 'preparation-protocol',
    nowMs: 2000,
  };
}

function probe(decision: UndercoverDecision): PreparationDecisionProbe {
  if (decision.kind === 'reject') {
    return { kind: 'reject', reason: decision.reason, selectionEffects: [] };
  }
  return {
    kind: 'commit',
    reason: null,
    selectionEffects: decision.effects
      .filter(
        (effect): effect is Extract<UndercoverEffect, { type: 'undercover.word.select' }> =>
          effect.type === 'undercover.word.select',
      )
      .map((effect) => ({
        roundId: effect.payload.roundId,
        usedSnapshot: [...effect.payload.avoidWordPairIds],
      })),
  };
}

class UndercoverPreparationSession implements PreparationSession {
  #state: UndercoverState;
  #startCount = 0;
  #selectionRoundId: string | null = null;

  constructor(full: boolean) {
    let state = undercoverEngine.createInitialState(
      { numberOfPlayers: 4, hasBlank: false, category: 'all' },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    state = this.#apply(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      hostContext('seat'),
    );
    if (full) {
      state = this.#apply(state, { type: 'room.seat.fillBots' }, hostContext('fill'));
    }
    this.#state = state;
  }

  #apply(state: UndercoverState, command: UndercoverCommand, context: CommandContext) {
    const decision = undercoverEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
    return undercoverEngine.normalize(decision.events.reduce(undercoverEngine.evolve, state));
  }

  #decide(command: UndercoverCommand, context: CommandContext): UndercoverDecision {
    return undercoverEngine.decide(this.#state, command, context);
  }

  phase(): string {
    return this.#state.phase;
  }

  pendingRoundId(): string | null {
    if (this.#state.phase === 'preparing' || this.#state.phase === 'preparationFailed') {
      return this.#state.pendingRound.roundId;
    }
    return this.#state.round?.roundId ?? null;
  }

  pendingRequestedAt(): number | null {
    if (this.#state.phase === 'preparing' || this.#state.phase === 'preparationFailed') {
      return this.#state.pendingRound.requestedAt;
    }
    return null;
  }

  usedSet(): readonly string[] {
    return this.#state.usedWordPairIds;
  }

  selectedKey(): string {
    return WORD_PAIR.id;
  }

  startDecision(): PreparationDecisionProbe {
    return probe(
      this.#decide(
        { type: 'undercover.roles.assign', shouldAllowRepeated: false },
        hostContext(`start-${this.#startCount}`),
      ),
    );
  }

  applyStart(): void {
    const decision = this.#decide(
      { type: 'undercover.roles.assign', shouldAllowRepeated: false },
      hostContext(`start-${this.#startCount}`),
    );
    if (decision.kind === 'reject') throw new Error(`Start rejected: ${decision.reason}`);
    this.#startCount += 1;
    this.#state = undercoverEngine.normalize(
      decision.events.reduce(undercoverEngine.evolve, this.#state),
    );
    if (this.#state.phase === 'preparing') {
      this.#selectionRoundId = this.#state.pendingRound.roundId;
    }
  }

  completeDecision(actorKind: 'system' | 'user', roundId: string): PreparationDecisionProbe {
    const context = actorKind === 'system' ? systemContext('complete') : hostContext('complete');
    return probe(
      this.#decide({ type: 'undercover.round.complete', roundId, wordPair: WORD_PAIR }, context),
    );
  }

  failDecision(
    actorKind: 'system' | 'user',
    roundId: string,
    failureCode: string,
  ): PreparationDecisionProbe {
    const context = actorKind === 'system' ? systemContext('fail') : hostContext('fail');
    return probe(
      this.#decide(
        {
          type: 'undercover.round.failPreparation',
          roundId,
          failureCode: failureCode as UndercoverPreparationFailure,
        },
        context,
      ),
    );
  }

  applyFail(failureCode: string): void {
    const roundId = this.pendingRoundId();
    if (roundId === null) throw new Error('No pending round to fail');
    this.#state = this.#apply(
      this.#state,
      {
        type: 'undercover.round.failPreparation',
        roundId,
        failureCode: failureCode as UndercoverPreparationFailure,
      },
      systemContext('fail'),
    );
  }

  applyComplete(): void {
    const roundId = this.pendingRoundId();
    if (roundId === null) throw new Error('No pending round to complete');
    this.#state = this.#apply(
      this.#state,
      { type: 'undercover.round.complete', roundId, wordPair: WORD_PAIR },
      systemContext('complete'),
    );
  }

  retryPreparation(): void {
    // D-1 reuse: the dedicated retry command replays the failed round.
    const roundId = this.pendingRoundId();
    if (roundId === null) throw new Error('No failed round to retry');
    const decision = this.#decide(
      { type: 'undercover.round.retry', roundId },
      hostContext('retry'),
    );
    if (decision.kind === 'reject') throw new Error(`Retry rejected: ${decision.reason}`);
    this.#state = undercoverEngine.normalize(
      decision.events.reduce(undercoverEngine.evolve, this.#state),
    );
    if (this.#state.phase === 'preparing') {
      this.#selectionRoundId = this.#state.pendingRound.roundId;
    }
  }

  failureCommand(): { readonly roundId: string; readonly failureCode: string } | null {
    if (this.#selectionRoundId === null) return null;
    return buildPreparationFailureCommand({
      isSelectionEffect: true,
      effectRoundId: this.#selectionRoundId,
      state: {
        phase: this.#state.phase,
        pendingRound:
          this.#state.phase === 'preparing' || this.#state.phase === 'preparationFailed'
            ? this.#state.pendingRound
            : null,
      },
      buildFailCommand: (roundId, failureCode) => ({ roundId, failureCode }),
    });
  }
}

describeWordPreparationProtocol({
  game: 'undercover',
  retryStrategy: 'reuse',
  notFullReason: UNDERCOVER_REASONS.notFull,
  alreadyPreparingReason: UNDERCOVER_REASONS.phase,
  notPreparingReason: UNDERCOVER_REASONS.phase,
  roundMismatchReason: UNDERCOVER_REASONS.round,
  makeSession: (full) => new UndercoverPreparationSession(full),
});

/**
 * Word Preparation Protocol — FibKing contract scenarios (P1).
 *
 * Runs the shared preparation propositions against the real FibKing
 * engine. FibKing injections: the three-stage vocabulary (completion
 * is gated on the final stage, driven here inside applyComplete),
 * the two-code failure subset, and the `fresh` retry strategy (D-1):
 * the preparationFailed "重新准备" is an ordinary start that freezes
 * a brand new pending round.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  describeWordPreparationProtocol,
  type PreparationDecisionProbe,
  type PreparationSession,
} from '../../../platform/room/__tests__/preparationScenarios';
import { buildPreparationFailureCommand } from '../../../platform/room/preparation';
import type { FibCommand } from '../commands/types';
import type { FibDecision } from '../domain/decision';
import {
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_PREPARING,
} from '../domain/reasons';
import type { FibEffect } from '../effects/types';
import { fibEngine } from '../engine';
import { FIB_PREPARATION_STAGES, type FibState } from '../state/types';

const WORD = '苹果';
const DEFINITION = {
  coreMeaning: '一种常见的水果，果肉清脆多汁，味道酸甜可口，深受人们喜爱。',
  usageNote: '日常生活中常被用来比喻平安吉祥，也经常出现在水果摊上。',
} as const;

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

function probe(decision: FibDecision): PreparationDecisionProbe {
  if (decision.kind === 'reject') {
    return { kind: 'reject', reason: decision.reason, selectionEffects: [] };
  }
  return {
    kind: 'commit',
    reason: null,
    selectionEffects: decision.effects
      .filter(
        (effect): effect is Extract<FibEffect, { type: 'fibking.word.select' }> =>
          effect.type === 'fibking.word.select',
      )
      .map((effect) => ({
        roundId: effect.payload.roundId,
        usedSnapshot: [...effect.payload.avoidWords],
      })),
  };
}

class FibPreparationSession implements PreparationSession {
  #state: FibState;
  #startCount = 0;
  #selectionRoundId: string | null = null;

  constructor(full: boolean) {
    let state = fibEngine.createInitialState(
      { numberOfPlayers: 4 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    if (full) state = this.#apply(state, { type: 'room.seat.fillBots' }, hostContext('fill'));
    this.#state = state;
  }

  #apply(state: FibState, command: FibCommand, context: CommandContext): FibState {
    const decision = fibEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
    return fibEngine.normalize(decision.events.reduce(fibEngine.evolve, state));
  }

  #decide(command: FibCommand, context: CommandContext): FibDecision {
    return fibEngine.decide(this.#state, command, context);
  }

  #startContext(): CommandContext {
    return hostContext(`start-${this.#startCount}`);
  }

  phase(): string {
    return this.#state.phase;
  }

  pendingRoundId(): string | null {
    if (this.#state.phase === 'preparing') return this.#state.pendingRound.roundId;
    if (this.#state.phase === 'preparationFailed') return this.#state.preparationFailure.roundId;
    return this.#state.round?.roundId ?? null;
  }

  pendingRequestedAt(): number | null {
    if (this.#state.phase === 'preparing') return this.#state.pendingRound.requestedAt;
    if (this.#state.phase === 'preparationFailed') {
      return this.#state.preparationFailure.requestedAt;
    }
    return null;
  }

  usedSet(): readonly string[] {
    return this.#state.usedWords;
  }

  selectedKey(): string {
    return WORD;
  }

  startDecision(): PreparationDecisionProbe {
    return probe(this.#decide({ type: 'fibking.round.start' }, this.#startContext()));
  }

  applyStart(): void {
    const decision = this.#decide({ type: 'fibking.round.start' }, this.#startContext());
    if (decision.kind === 'reject') throw new Error(`Start rejected: ${decision.reason}`);
    this.#startCount += 1;
    this.#state = fibEngine.normalize(decision.events.reduce(fibEngine.evolve, this.#state));
    if (this.#state.phase === 'preparing') {
      this.#selectionRoundId = this.#state.pendingRound.roundId;
    }
  }

  completeDecision(actorKind: 'system' | 'user', roundId: string): PreparationDecisionProbe {
    const context = actorKind === 'system' ? systemContext('complete') : hostContext('complete');
    return probe(
      this.#decide(
        {
          type: 'fibking.round.complete',
          roundId,
          word: WORD,
          definition: DEFINITION,
          source: 'local',
        },
        context,
      ),
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
          type: 'fibking.round.failPreparation',
          roundId,
          failureCode: failureCode as 'selectionFailed' | 'inventoryExhausted',
        },
        context,
      ),
    );
  }

  applyFail(failureCode: string): void {
    const roundId = this.pendingRoundId();
    if (roundId === null) throw new Error('No pending round to fail');
    const decision = this.failDecisionRaw(roundId, failureCode);
    if (decision.kind === 'reject') throw new Error(`Fail rejected: ${decision.reason}`);
    this.#state = fibEngine.normalize(decision.events.reduce(fibEngine.evolve, this.#state));
  }

  failDecisionRaw(roundId: string, failureCode: string): FibDecision {
    return this.#decide(
      {
        type: 'fibking.round.failPreparation',
        roundId,
        failureCode: failureCode as 'selectionFailed' | 'inventoryExhausted',
      },
      systemContext('fail'),
    );
  }

  applyComplete(): void {
    // FibKing's stage gate (D-5): walk the pending round to the final
    // stage through the game's own stage command, then complete.
    for (const stage of [FIB_PREPARATION_STAGES.selecting, FIB_PREPARATION_STAGES.finalizing]) {
      const roundId = this.pendingRoundId();
      if (roundId === null) throw new Error('No pending round to advance');
      this.#state = this.#apply(
        this.#state,
        { type: 'fibking.round.updatePreparationStage', roundId, stage },
        systemContext(`stage-${stage}`),
      );
    }
    const roundId = this.pendingRoundId();
    if (roundId === null) throw new Error('No pending round to complete');
    this.#state = this.#apply(
      this.#state,
      {
        type: 'fibking.round.complete',
        roundId,
        word: WORD,
        definition: DEFINITION,
        source: 'local',
      },
      systemContext('complete'),
    );
  }

  retryPreparation(): void {
    // D-1 fresh: "重新准备" is the ordinary start command again.
    this.applyStart();
  }

  failureCommand(): { readonly roundId: string; readonly failureCode: string } | null {
    if (this.#selectionRoundId === null) return null;
    return buildPreparationFailureCommand({
      isSelectionEffect: true,
      effectRoundId: this.#selectionRoundId,
      state: {
        phase: this.#state.phase,
        pendingRound: this.#state.phase === 'preparing' ? this.#state.pendingRound : null,
      },
      buildFailCommand: (roundId, failureCode) => ({ roundId, failureCode }),
    });
  }
}

describeWordPreparationProtocol({
  game: 'fibking',
  retryStrategy: 'fresh',
  notFullReason: REASON_FIB_ROUND_NOT_FULL,
  alreadyPreparingReason: REASON_FIB_ROUND_ALREADY_ONGOING,
  notPreparingReason: REASON_FIB_ROUND_NOT_PREPARING,
  roundMismatchReason: REASON_FIB_ROUND_MISMATCH,
  makeSession: (full) => new FibPreparationSession(full),
});

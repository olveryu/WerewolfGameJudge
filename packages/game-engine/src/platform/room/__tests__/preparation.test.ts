/**
 * Word Preparation Protocol — unit tests for the shared predicates,
 * the stage vocabulary, the retry strategies and the runtime
 * fallback command builder (E2). The decide skeleton is pinned
 * end-to-end by the per-game contract suites that run the shared
 * preparation scenarios against both engines.
 */

import { describe, expect, it } from 'vitest';

import {
  buildPreparationFailureCommand,
  getPendingRound,
  isFinalPreparationStage,
  isPreparationFailed,
  isPreparationFailureCode,
  isPreparing,
  isPreparingRound,
  nextPreparationStage,
  PREPARATION_FAILURE_CODES,
  resolvePreparationRetryPending,
} from '../preparation';

const pending = { roundId: 'round-1', requestedAt: 100 };

describe('Word Preparation Protocol predicates', () => {
  it('recognizes the preparing state and its pending round', () => {
    const preparing = { phase: 'preparing', pendingRound: pending };
    expect(isPreparing(preparing)).toBe(true);
    expect(getPendingRound(preparing)).toBe(pending);
    expect(isPreparingRound(preparing, 'round-1')).toBe(true);
    expect(isPreparingRound(preparing, 'round-2')).toBe(false);
    expect(isPreparationFailed(preparing)).toBe(false);
  });

  it('treats a preparing phase without a pending round as not preparing', () => {
    const broken = { phase: 'preparing', pendingRound: null };
    expect(isPreparing(broken)).toBe(false);
    expect(getPendingRound(broken)).toBe(null);
    expect(isPreparingRound(broken, 'round-1')).toBe(false);
  });

  it('recognizes the failed state', () => {
    const failed = { phase: 'preparationFailed', pendingRound: null };
    expect(isPreparationFailed(failed)).toBe(true);
    expect(isPreparing(failed)).toBe(false);
  });
});

describe('Word Preparation Protocol failure codes (D-2 superset)', () => {
  it('is exactly the three-code superset', () => {
    expect(PREPARATION_FAILURE_CODES).toEqual([
      'selectionFailed',
      'inventoryEmpty',
      'inventoryExhausted',
    ]);
    for (const code of PREPARATION_FAILURE_CODES) {
      expect(isPreparationFailureCode(code)).toBe(true);
    }
    expect(isPreparationFailureCode('wordInvalid')).toBe(false);
    expect(isPreparationFailureCode(null)).toBe(false);
  });
});

describe('Word Preparation Protocol stage vocabulary (D-5)', () => {
  const stages = ['queued', 'selecting', 'finalizing'] as const;

  it('advances one stage at a time and stops at the final stage', () => {
    expect(nextPreparationStage(stages, 'queued')).toBe('selecting');
    expect(nextPreparationStage(stages, 'selecting')).toBe('finalizing');
    expect(nextPreparationStage(stages, 'finalizing')).toBe(null);
  });

  it('has no next or final stage for the empty vocabulary', () => {
    const empty: readonly string[] = [];
    expect(nextPreparationStage(empty, 'queued')).toBe(null);
    expect(isFinalPreparationStage(empty, 'queued')).toBe(false);
  });

  it('marks only the last stage as final', () => {
    expect(isFinalPreparationStage(stages, 'finalizing')).toBe(true);
    expect(isFinalPreparationStage(stages, 'selecting')).toBe(false);
  });
});

describe('Word Preparation Protocol retry strategies (D-1)', () => {
  it('reuse returns the failed pending round untouched', () => {
    const resolved = resolvePreparationRetryPending('reuse', pending, () => {
      throw new Error('fresh builder must not run for reuse');
    });
    expect(resolved).toBe(pending);
  });

  it('fresh builds a new pending round and ignores the failed one', () => {
    const fresh = { roundId: 'round-2', requestedAt: 200 };
    expect(resolvePreparationRetryPending('fresh', pending, () => fresh)).toBe(fresh);
    expect(resolvePreparationRetryPending('fresh', null, () => fresh)).toBe(fresh);
  });

  it('reuse without a failed pending round fails fast', () => {
    expect(() => resolvePreparationRetryPending('reuse', null, () => pending)).toThrow(
      'A reuse retry requires the failed pending round',
    );
  });
});

describe('Word Preparation Protocol runtime fallback command', () => {
  const buildFailCommand = (roundId: string, failureCode: 'selectionFailed') => ({
    type: 'failPreparation',
    roundId,
    failureCode,
  });

  it('synthesizes a selectionFailed command for the round still preparing', () => {
    const command = buildPreparationFailureCommand({
      isSelectionEffect: true,
      effectRoundId: 'round-1',
      state: { phase: 'preparing', pendingRound: pending },
      buildFailCommand,
    });
    expect(command).toEqual({
      type: 'failPreparation',
      roundId: 'round-1',
      failureCode: 'selectionFailed',
    });
  });

  it('synthesizes nothing for non-selection effects or superseded rounds', () => {
    expect(
      buildPreparationFailureCommand({
        isSelectionEffect: false,
        effectRoundId: 'round-1',
        state: { phase: 'preparing', pendingRound: pending },
        buildFailCommand,
      }),
    ).toBe(null);
    expect(
      buildPreparationFailureCommand({
        isSelectionEffect: true,
        effectRoundId: 'round-9',
        state: { phase: 'preparing', pendingRound: pending },
        buildFailCommand,
      }),
    ).toBe(null);
    expect(
      buildPreparationFailureCommand({
        isSelectionEffect: true,
        effectRoundId: 'round-1',
        state: { phase: 'preparationFailed', pendingRound: null },
        buildFailCommand,
      }),
    ).toBe(null);
  });
});

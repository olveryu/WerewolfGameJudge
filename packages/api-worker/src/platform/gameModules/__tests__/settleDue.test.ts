/**
 * settleDue business keys (P0, phase-expiry redesign): the segment
 * order is fixed, absent fields contribute no segment, and extending
 * the pin with the relay phase-identity fields leaves every existing
 * game's key byte-identical. Delivery time is the pinned deadline.
 */

import { describe, expect, it } from 'vitest';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../settleDue';

describe('settleDueBusinessKey', () => {
  it('keeps the demo key (sequence and deadline only) unchanged', () => {
    expect(settleDueBusinessKey('demo:settle', { gameSequence: 4, deadlineAt: 61000 })).toBe(
      'demo:settle:4:61000',
    );
  });

  it('keeps the avalon key (sequence, phase, round, deadline) unchanged', () => {
    expect(
      settleDueBusinessKey('avalon:settle', {
        gameSequence: 2,
        phase: 'vote',
        round: 3,
        deadlineAt: 9000,
      }),
    ).toBe('avalon:settle:2:vote:3:9000');
  });

  it('keeps the werewolf key (sequence, phase, deadline) unchanged', () => {
    expect(
      settleDueBusinessKey('werewolf:settle', {
        gameSequence: 1,
        phase: 'step-3',
        deadlineAt: 9000,
      }),
    ).toBe('werewolf:settle:1:step-3:9000');
  });

  it('appends the relay pin segments after the deadline, in fixed order', () => {
    expect(
      settleDueBusinessKey('pictionary:settle', {
        roundId: 'pictionary-round:command-1',
        phaseRevision: 4,
        stepIndex: 2,
        deadlineAt: 61000,
      }),
    ).toBe('pictionary:settle:61000:pictionary-round:command-1:4:2');
    expect(
      settleDueBusinessKey('drawguess:settle', {
        gameSequence: 1,
        phaseRevision: 5,
        turnIndex: 0,
        deadlineAt: 61000,
      }),
    ).toBe('drawguess:settle:1:61000:5:0');
  });

  it('distinguishes armings that differ in exactly one pin field', () => {
    const base = {
      roundId: 'pictionary-round:command-1',
      phaseRevision: 4,
      stepIndex: 2,
      deadlineAt: 61000,
    };
    const keys = new Set([
      settleDueBusinessKey('pictionary:settle', base),
      settleDueBusinessKey('pictionary:settle', { ...base, phaseRevision: 5 }),
      settleDueBusinessKey('pictionary:settle', { ...base, stepIndex: 3 }),
      settleDueBusinessKey('pictionary:settle', { ...base, deadlineAt: 62000 }),
    ]);
    expect(keys.size).toBe(4);
  });

  it('dedupes the same arming: the same pin always yields the same key', () => {
    const pin = {
      roundId: 'storyrelay-round:command-9',
      phaseRevision: 1,
      stepIndex: 0,
      deadlineAt: 45000,
    };
    expect(settleDueBusinessKey('storyrelay:settle', pin)).toBe(
      settleDueBusinessKey('storyrelay:settle', { ...pin }),
    );
    expect(settleDueBusinessKey('storyrelay:settle', pin)).toBe(
      'storyrelay:settle:45000:storyrelay-round:command-9:1:0',
    );
  });
});

describe('settleDueDeliveryAt', () => {
  it('parks the effect until its pinned deadline', () => {
    expect(settleDueDeliveryAt({ deadlineAt: 61000 })).toBe(61000);
  });
});

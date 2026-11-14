/**
 * Settle arming invariant — pictionary (phase-expiry redesign §5.1).
 *
 * Every decision that writes a deadline returns exactly one
 * settle.due effect whose pin equals the evolved state's phase
 * identity (round, revision, step, deadline); every decision that
 * writes no deadline (or a null deadline) returns none. The pin is
 * always read off the evolved state, never hand-computed in the
 * test, so a wrong +1 at any arming point fails here.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import type {
  PictionaryCommand,
  PictionaryCommandInput,
  PictionaryInternalCommand,
} from '../commands/types';
import { REASON_PICTIONARY_PHASE_NOT_EXPIRED } from '../domain/reasons';
import type { PictionaryEffect } from '../effects/types';
import { pictionaryEngine } from '../engine';
import { parsePictionaryState } from '../state/parseState';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
} from '../state/types';
import { bindPictionaryCommand } from './commandBinding';

type PictionaryInput = PictionaryCommandInput | PictionaryInternalCommand;

const NUMBER_OF_PLAYERS = 4;

function game() {
  const session = createEngineSession(pictionaryEngine, {
    config: {
      ...DEFAULT_PICTIONARY_CONFIG,
      numberOfPlayers: NUMBER_OF_PLAYERS,
      drawingDurationSeconds: 90,
      guessDurationSeconds: 45,
      transitionDurationSeconds: 5,
      galleryItemDurationSeconds: 10,
    },
    create: { hostUserId: 'user-0', roomCode: '2468' },
    parse: parsePictionaryState,
  });
  const send = (input: PictionaryInput, userId = 'user-0') => {
    const context = session.context(userId);
    return session.sendAs(bindPictionaryCommand(session.state, input, context), context);
  };
  for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
      `user-${seat}`,
    );
  }
  return { session, send };
}

function effectsOf(
  session: ReturnType<typeof game>['session'],
  run: () => void,
): readonly PictionaryEffect[] {
  const before = session.effects.length;
  run();
  return session.effects.slice(before);
}

function expectSingleSettle(
  session: ReturnType<typeof game>['session'],
  effects: readonly PictionaryEffect[],
): void {
  const settles = effects.filter((effect) => effect.type === 'pictionary.settle.due');
  expect(settles).toHaveLength(1);
  const settle = settles[0];
  if (settle === undefined) throw new Error('Expected one settle effect');
  const state = session.state;
  if (state.roundId === null || state.deadlineAt === null) {
    throw new Error('Expected an armed phase identity after the decision');
  }
  expect(settle).toEqual({
    type: 'pictionary.settle.due',
    payload: {
      roundId: state.roundId,
      phaseRevision: state.phaseRevision,
      stepIndex: state.stepIndex,
      deadlineAt: state.deadlineAt,
    },
  });
}

function expectNoSettle(effects: readonly PictionaryEffect[]): void {
  expect(effects.filter((effect) => effect.type === 'pictionary.settle.due')).toHaveLength(0);
}

describe('Pictionary settle arming invariant', () => {
  it('arms the answering deadline when the round starts', () => {
    const { session, send } = game();
    const effects = effectsOf(session, () => {
      send({ type: 'pictionary.game.begin' });
    });
    expect(effects).toHaveLength(1);
    expectSingleSettle(session, effects);
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(0);
  });

  it('arms no settle when readiness completes into a null deadline', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });
    const before = session.effects.length;
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
    }
    expect(session.state.phase).toBe('settling');
    expect(session.state.deadlineAt).toBeNull();
    expectNoSettle(session.effects.slice(before));
  });

  it('arms the transition deadline when the last text entry lands', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
    }
    for (let seat = 0; seat < NUMBER_OF_PLAYERS - 1; seat += 1) {
      const effects = effectsOf(session, () => {
        send({ type: 'pictionary.text.submit', text: `step-0-seat-${seat}` }, `user-${seat}`);
      });
      expectNoSettle(effects);
    }
    const effects = effectsOf(session, () => {
      send({ type: 'pictionary.text.submit', text: 'step-0-seat-3' }, 'user-3');
    });
    expectSingleSettle(session, effects);
    expect(session.state.phase).toBe('transition');
  });

  it('arms the next answering deadline when a transition expires, and the gallery deadline on the last step', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });

    const submitStep = (stepIndex: number) => {
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
      }
      if (getPictionaryExpectedKind(stepIndex) === 'text') {
        for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
          send(
            { type: 'pictionary.text.submit', text: `step-${stepIndex}-seat-${seat}` },
            `user-${seat}`,
          );
        }
        return;
      }
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
        const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
        if (reservation === undefined) throw new Error('Missing reservation');
        session.sendAs(
          {
            type: 'pictionary.drawing.commit',
            submissionId: reservation.submissionId,
            media: {
              objectKey: `test/drawing-${stepIndex}-${seat}.png`,
              contentType: 'image/png',
              replay: null,
              width: PICTIONARY_DRAWING_WIDTH,
              height: PICTIONARY_DRAWING_HEIGHT,
              byteLength: 1024,
              sha256: 'test-sha',
            },
          } satisfies PictionaryCommand,
          session.systemContext('drawing-upload'),
        );
      }
    };

    const expireCurrentPhase = () => {
      const deadline = session.state.deadlineAt;
      if (deadline === null) throw new Error('Expected an armed deadline');
      session.setNow(deadline);
      return effectsOf(session, () => {
        session.sendAs(
          { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
          session.systemContext('settle'),
        );
      });
    };

    // Step 0 (text) -> transition, expire -> step 1 answering, armed.
    submitStep(0);
    expect(session.state.phase).toBe('transition');
    expectSingleSettle(session, expireCurrentPhase());
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(1);

    // Step 1 (drawing): a mid-step drawing commit arms nothing.
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
    }
    send({ type: 'pictionary.drawing.reserve' }, 'user-0');
    const reservation = session.state.reservations.find((item) => item.authorSeat === 0);
    if (reservation === undefined) throw new Error('Missing reservation');
    const midEffects = effectsOf(session, () => {
      session.sendAs(
        {
          type: 'pictionary.drawing.commit',
          submissionId: reservation.submissionId,
          media: {
            objectKey: 'test/drawing-1-0.png',
            contentType: 'image/png',
            replay: null,
            width: PICTIONARY_DRAWING_WIDTH,
            height: PICTIONARY_DRAWING_HEIGHT,
            byteLength: 1024,
            sha256: 'test-sha',
          },
        } satisfies PictionaryCommand,
        session.systemContext('drawing-upload'),
      );
    });
    expectNoSettle(midEffects);

    // Finish step 1 with the remaining seats -> transition, expire
    // -> step 2 answering, armed.
    for (let seat = 1; seat < NUMBER_OF_PLAYERS; seat += 1) {
      send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
      const remaining = session.state.reservations.find((item) => item.authorSeat === seat);
      if (remaining === undefined) throw new Error('Missing reservation');
      session.sendAs(
        {
          type: 'pictionary.drawing.commit',
          submissionId: remaining.submissionId,
          media: {
            objectKey: `test/drawing-1-${seat}.png`,
            contentType: 'image/png',
            replay: null,
            width: PICTIONARY_DRAWING_WIDTH,
            height: PICTIONARY_DRAWING_HEIGHT,
            byteLength: 1024,
            sha256: 'test-sha',
          },
        } satisfies PictionaryCommand,
        session.systemContext('drawing-upload'),
      );
    }
    expect(session.state.phase).toBe('transition');
    expectSingleSettle(session, expireCurrentPhase());
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(2);

    // Step 2 (text) -> transition, expire -> step 3 answering, armed.
    submitStep(2);
    expectSingleSettle(session, expireCurrentPhase());
    expect(session.state.stepIndex).toBe(3);

    // Step 3 (drawing, final): the last entry arms transition and
    // fires the completion effect alongside it.
    const finalEffects = effectsOf(session, () => {
      submitStep(3);
    });
    expect(
      finalEffects.filter((effect) => effect.type === 'pictionary.game.completed'),
    ).toHaveLength(1);
    expectSingleSettle(session, finalEffects);
    expect(session.state.phase).toBe('transition');

    // Expire the final transition -> gallery, armed with the gallery deadline.
    expectSingleSettle(session, expireCurrentPhase());
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).not.toBeNull();
  });

  it('arms gallery advance and resume deadlines, and nothing on pause or finish', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });

    const submitStep = (stepIndex: number) => {
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
      }
      if (getPictionaryExpectedKind(stepIndex) === 'text') {
        for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
          send(
            { type: 'pictionary.text.submit', text: `step-${stepIndex}-seat-${seat}` },
            `user-${seat}`,
          );
        }
        return;
      }
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
        const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
        if (reservation === undefined) throw new Error('Missing reservation');
        session.sendAs(
          {
            type: 'pictionary.drawing.commit',
            submissionId: reservation.submissionId,
            media: {
              objectKey: `test/drawing-${stepIndex}-${seat}.png`,
              contentType: 'image/png',
              replay: null,
              width: PICTIONARY_DRAWING_WIDTH,
              height: PICTIONARY_DRAWING_HEIGHT,
              byteLength: 1024,
              sha256: 'test-sha',
            },
          } satisfies PictionaryCommand,
          session.systemContext('drawing-upload'),
        );
      }
    };
    const expireCurrentPhase = () => {
      const deadline = session.state.deadlineAt;
      if (deadline === null) throw new Error('Expected an armed deadline');
      session.setNow(deadline);
      session.sendAs(
        { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
        session.systemContext('settle'),
      );
    };

    for (let stepIndex = 0; stepIndex < NUMBER_OF_PLAYERS; stepIndex += 1) {
      submitStep(stepIndex);
      expireCurrentPhase();
    }
    expect(session.state.phase).toBe('gallery');
    const galleryDeadline = session.state.deadlineAt;
    if (galleryDeadline === null) throw new Error('Expected an armed gallery deadline');

    // Advance to the next cell: new deadline, new settle arming.
    session.setNow(galleryDeadline - 1000);
    expectSingleSettle(
      session,
      effectsOf(session, () => {
        send({ type: 'pictionary.gallery.advance' });
      }),
    );

    // Pause writes a null deadline: no arming.
    expectNoSettle(
      effectsOf(session, () => {
        send({ type: 'pictionary.gallery.pause' });
      }),
    );
    expect(session.state.deadlineAt).toBeNull();

    // Resume restores the remaining time: new deadline, new arming,
    // with a pin that differs from the pre-pause arming.
    const prePauseRevision = session.state.phaseRevision;
    const resumeEffects = effectsOf(session, () => {
      send({ type: 'pictionary.gallery.resume' });
    });
    expectSingleSettle(session, resumeEffects);
    expect(session.state.phaseRevision).toBe(prePauseRevision + 1);

    // Finish ends the gallery with a null deadline: no arming.
    expectNoSettle(
      effectsOf(session, () => {
        send({ type: 'pictionary.gallery.finish' });
      }),
    );
    expect(session.state.phase).toBe('ended');
  });

  it('arms nothing on abort, and rejects an early internal settle', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });
    const deadline = session.state.deadlineAt;
    if (deadline === null) throw new Error('Missing answering deadline');

    const early = session.decideAs(
      { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
      session.systemContext('settle'),
    );
    expect(early).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_PHASE_NOT_EXPIRED,
    });
    expect(session.state.phase).toBe('answering');

    expectNoSettle(
      effectsOf(session, () => {
        send({ type: 'pictionary.game.abort' });
      }),
    );
    expect(session.state.phase).toBe('aborted');
  });

  it('dispatches the internal settle at the deadline through the system channel', () => {
    const { session, send } = game();
    send({ type: 'pictionary.game.begin' });
    const deadline = session.state.deadlineAt;
    if (deadline === null) throw new Error('Missing answering deadline');
    session.setNow(deadline);
    const decision = session.decideAs(
      { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
      session.systemContext('settle'),
    );
    expect(decision.kind).toBe('commit');
    session.sendAs(
      { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
      session.systemContext('settle'),
    );
    expect(session.state.phase).toBe('settling');
  });
});

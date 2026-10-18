/**
 * Pictionary engine mainline (AU-44): lobby → relay steps →
 * gallery → ended, driven through authoritative commands on the
 * shared session harness.
 *
 * Pictionary commands are seat-bound before decide (the game's
 * public inputs carry no seat), so this suite binds each input
 * through createPictionaryCommand exactly like the worker does;
 * the session supplies state plumbing, the parser round-trip,
 * the clock, and effect collection. Edge cases live in the
 * topic suites (taskSequence, botControl, stateParsing).
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import type { PictionaryCommandInput, PictionaryInternalCommand } from '../commands/types';
import { REASON_PICTIONARY_ROOM_NOT_FULL } from '../domain/reasons';
import { getPictionaryTaskForSeat } from '../domain/visibility';
import { pictionaryEngine } from '../engine';
import { parsePictionaryState } from '../state/parseState';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  type PictionaryState,
} from '../state/types';
import { bindPictionaryCommand } from './commandBinding';

type PictionaryInput = PictionaryCommandInput | PictionaryInternalCommand;

const bind = bindPictionaryCommand;

function game(numberOfPlayers = 4) {
  const session = createEngineSession(pictionaryEngine, {
    config: { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers, drawingDurationSeconds: 90 },
    create: { hostUserId: 'user-0', roomCode: '2468' },
    parse: parsePictionaryState,
  });
  const send = (input: PictionaryInput, userId = 'user-0') => {
    const context = session.context(userId);
    return session.sendAs(bind(session.state, input, context), context);
  };
  const takeAllSeats = () => {
    for (let seat = 0; seat < numberOfPlayers; seat += 1) {
      send(
        { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
        `user-${seat}`,
      );
    }
  };
  const phaseNow = (): PictionaryState['phase'] => session.state.phase;
  const expireCurrentPhase = () => {
    const state = session.state;
    if (state.deadlineAt === null) throw new Error(`Expected ${state.phase} to have a deadline`);
    session.setNow(state.deadlineAt);
    return send({ type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision });
  };
  /** Authors real content for every seat, so all seats earn the completion roster. */
  const completeCurrentStep = () => {
    expireCurrentPhase();
    if (phaseNow() !== 'settling') throw new Error('Expected settling');
    const stepIndex = session.state.stepIndex;
    for (let seat = 0; seat < numberOfPlayers; seat += 1) {
      if (getPictionaryExpectedKind(stepIndex) === 'text') {
        send(
          { type: 'pictionary.text.submit', text: `第${stepIndex}步${seat}号的文字` },
          `user-${seat}`,
        );
      } else {
        send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
        const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
        if (reservation === undefined) throw new Error(`Missing reservation for seat ${seat}`);
        session.sendAs(
          {
            type: 'pictionary.drawing.commit',
            submissionId: reservation.submissionId,
            media: {
              objectKey: `test/drawing-${stepIndex}-${seat}.png`,
              contentType: 'image/png',
              width: PICTIONARY_DRAWING_WIDTH,
              height: PICTIONARY_DRAWING_HEIGHT,
              byteLength: 1024,
              sha256: 'test-sha',
            },
          },
          session.systemContext('drawing-upload'),
        );
      }
    }
    if (phaseNow() !== 'transition') throw new Error('Expected transition');
    expireCurrentPhase();
  };
  return { session, send, takeAllSeats, expireCurrentPhase, completeCurrentStep };
}

describe('Pictionary engine', () => {
  it('rejects starting before the room is full', () => {
    const { session, send } = game();
    send({ type: 'room.seat.take', seat: 0, profile: { displayName: '玩家 1' } });
    const context = session.context('user-0');
    const decision = session.decideAs(
      bind(session.state, { type: 'pictionary.round.start' }, context),
      context,
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_PICTIONARY_ROOM_NOT_FULL });
    expect(session.state.phase).toBe('lobby');
  });

  it('runs the full relay into the gallery and completes exactly once', () => {
    const { session, send, takeAllSeats, completeCurrentStep } = game();
    takeAllSeats();
    send({ type: 'pictionary.round.start' });
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(0);

    // Each seat holds a distinct chain task for the step.
    const chainIds = new Set(
      Array.from(
        { length: 4 },
        (_, seat) => getPictionaryTaskForSeat(session.state, seat)?.chain.id,
      ),
    );
    expect(chainIds.size).toBe(4);

    for (let step = 0; step < 4; step += 1) completeCurrentStep();
    expect(session.state.phase).toBe('gallery');

    send({ type: 'pictionary.gallery.finish' });
    expect(session.state.phase).toBe('ended');
    const completions = session.effects.filter(
      (effect) => effect.type === 'pictionary.game.completed',
    );
    expect(completions).toHaveLength(1);
    expect(completions[0]?.payload.participantUserIds).toEqual([
      'user-0',
      'user-1',
      'user-2',
      'user-3',
    ]);

    send({ type: 'pictionary.game.returnToLobby' });
    expect(session.state.phase).toBe('lobby');
    expect(session.state.participants).toEqual([]);
  });

  it('settles when the last drawing of the final step lands, before the gallery opens', () => {
    const { session, send, takeAllSeats, expireCurrentPhase, completeCurrentStep } = game();
    takeAllSeats();
    send({ type: 'pictionary.round.start' });
    for (let step = 0; step < 3; step += 1) completeCurrentStep();

    // The final step (step 3) is a drawing step: its entries land
    // through drawing commits, which bypass the shared task machine.
    expireCurrentPhase();
    expect(session.state.phase).toBe('settling');
    expect(session.state.stepIndex).toBe(3);
    for (let seat = 0; seat < 4; seat += 1) {
      send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
      const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
      if (reservation === undefined) throw new Error(`Missing reservation for seat ${seat}`);
      session.sendAs(
        {
          type: 'pictionary.drawing.commit',
          submissionId: reservation.submissionId,
          media: {
            objectKey: `test/final-drawing-${seat}.png`,
            contentType: 'image/png',
            width: PICTIONARY_DRAWING_WIDTH,
            height: PICTIONARY_DRAWING_HEIGHT,
            byteLength: 1024,
            sha256: 'test-sha',
          },
        },
        session.systemContext('drawing-upload'),
      );
    }

    // The settlement already fired with the last commit; the round
    // is still in its final transition, the gallery has not opened.
    expect(session.state.phase).toBe('transition');
    const completions = session.effects.filter(
      (effect) => effect.type === 'pictionary.game.completed',
    );
    expect(completions).toHaveLength(1);
    expect(completions[0]?.payload.participantUserIds).toEqual([
      'user-0',
      'user-1',
      'user-2',
      'user-3',
    ]);

    expireCurrentPhase();
    expect(session.state.phase).toBe('gallery');
    expect(
      session.effects.filter((effect) => effect.type === 'pictionary.game.completed'),
    ).toHaveLength(1);
  });

  it('keeps the completion-moment settlement population through the gallery', () => {
    const { session, send, takeAllSeats, expireCurrentPhase } = game(5);
    takeAllSeats();
    send({ type: 'pictionary.round.start' });

    const authorContent = (seat: number) => {
      const stepIndex = session.state.stepIndex;
      if (getPictionaryExpectedKind(stepIndex) === 'text') {
        send(
          { type: 'pictionary.text.submit', text: `step-${stepIndex}-seat-${seat}` },
          `user-${seat}`,
        );
        return;
      }
      send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
      const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
      if (reservation === undefined) throw new Error(`Missing reservation for seat ${seat}`);
      session.sendAs(
        {
          type: 'pictionary.drawing.commit',
          submissionId: reservation.submissionId,
          media: {
            objectKey: `test/snapshot-drawing-${stepIndex}-${seat}.png`,
            contentType: 'image/png',
            width: PICTIONARY_DRAWING_WIDTH,
            height: PICTIONARY_DRAWING_HEIGHT,
            byteLength: 1024,
            sha256: 'test-sha',
          },
        },
        session.systemContext('drawing-upload'),
      );
    };

    // Seat 4 authors nothing countable (empty submissions only);
    // every other seat authors real content in every step.
    for (let step = 0; step < 5; step += 1) {
      expireCurrentPhase();
      expect(session.state.phase).toBe('settling');
      for (let seat = 0; seat < 5; seat += 1) {
        if (seat === 4) {
          send({ type: 'pictionary.task.empty.submit' }, 'user-4');
        } else {
          authorContent(seat);
        }
      }
      expect(session.state.phase).toBe('transition');
      if (step < 4) expireCurrentPhase();
    }

    // Settled at the final step's completion, from the frozen
    // participant snapshot: seat 4 is seated yet earns nothing.
    const completions = session.effects.filter(
      (effect) => effect.type === 'pictionary.game.completed',
    );
    expect(completions).toHaveLength(1);
    expect(completions[0]?.payload.participantUserIds).toEqual([
      'user-0',
      'user-1',
      'user-2',
      'user-3',
    ]);

    // Traversing the gallery neither re-settles nor rewrites the
    // emitted population.
    expireCurrentPhase();
    expect(session.state.phase).toBe('gallery');
    send({ type: 'pictionary.gallery.finish' });
    expect(session.state.phase).toBe('ended');
    const afterGallery = session.effects.filter(
      (effect) => effect.type === 'pictionary.game.completed',
    );
    expect(afterGallery).toHaveLength(1);
    expect(afterGallery[0]?.payload).toEqual(completions[0]?.payload);
  });
});

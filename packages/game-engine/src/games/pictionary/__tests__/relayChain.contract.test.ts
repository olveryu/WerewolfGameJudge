/**
 * Relay Chain — Pictionary assembly contract (E1).
 *
 * Pictionary runs on the shared relay machine
 * (platform/room/relay); this file pins the machine's contract
 * propositions against the real Pictionary engine, driven only
 * through authoritative commands: rotation invariants, the task
 * privacy boundary, gallery timer/reveal behavior, and the phase
 * revision contract — the same proposition set Story Relay pins in
 * its relayChain.contract.test.ts.
 *
 * Pictionary's settlement caliber is pinned here too: the round
 * settles when the final step's last entry lands, from the frozen
 * participant list — the caliber Story Relay runs (unified by the
 * 2026-10-18 ruling); entering the gallery settles nothing. Its
 * remaining registered difference, a stale-revision phase.expire
 * silently committing empty instead of rejecting, is pinned here
 * as well — the proposition is that an expired command never
 * changes state.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_SEATED } from '../../../platform/protocol/reasons';
import type {
  PictionaryCommand,
  PictionaryCommandInput,
  PictionaryInternalCommand,
} from '../commands/types';
import {
  REASON_PICTIONARY_GALLERY_MANUAL,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
  REASON_PICTIONARY_TASK_INVALID,
} from '../domain/reasons';
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

const NUMBER_OF_PLAYERS = 4;

function game(galleryItemDurationSeconds: 10 | null = 10) {
  const session = createEngineSession(pictionaryEngine, {
    config: {
      ...DEFAULT_PICTIONARY_CONFIG,
      numberOfPlayers: NUMBER_OF_PLAYERS,
      drawingDurationSeconds: 90,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds,
    },
    create: { hostUserId: 'user-0', roomCode: '2468' },
    parse: parsePictionaryState,
  });
  const send = (input: PictionaryInput, userId = 'user-0') => {
    const context = session.context(userId);
    return session.sendAs(bindPictionaryCommand(session.state, input, context), context);
  };
  const decide = (input: PictionaryInput, userId = 'user-0') => {
    const context = session.context(userId);
    return session.decideAs(bindPictionaryCommand(session.state, input, context), context);
  };
  for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
      `user-${seat}`,
    );
  }
  send({ type: 'pictionary.round.start' });

  function expireCurrentPhase() {
    const state = session.state;
    if (state.deadlineAt === null) throw new Error(`Expected ${state.phase} to have a deadline`);
    session.setNow(state.deadlineAt);
    return send({ type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision });
  }

  /** Authors real content for one seat at the current settling step. */
  function author(seat: number): PictionaryState {
    const stepIndex = session.state.stepIndex;
    if (getPictionaryExpectedKind(stepIndex) === 'text') {
      return send(
        { type: 'pictionary.text.submit', text: `step-${stepIndex}-seat-${seat}` },
        `user-${seat}`,
      );
    }
    send({ type: 'pictionary.drawing.reserve' }, `user-${seat}`);
    const reservation = session.state.reservations.find((item) => item.authorSeat === seat);
    if (reservation === undefined) throw new Error(`Missing reservation for seat ${seat}`);
    return session.sendAs(
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

  /** Plays one full step: answering expires into settling, every seat authors, transition expires. */
  function playStep() {
    expireCurrentPhase();
    if (session.state.phase !== 'settling') throw new Error('Expected settling');
    let stateAfterAuthoring = session.state;
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) stateAfterAuthoring = author(seat);
    if (stateAfterAuthoring.phase !== 'transition') throw new Error('Expected transition');
    expireCurrentPhase();
  }

  function playRound() {
    for (let step = 0; step < NUMBER_OF_PLAYERS; step += 1) playStep();
  }

  function gallery(command: 'pause' | 'resume' | 'advance' | 'rewind' | 'finish') {
    return send({ type: `pictionary.gallery.${command}` });
  }

  return {
    get state(): PictionaryState {
      return session.state;
    },
    get effects() {
      return session.effects;
    },
    session,
    send,
    decide,
    setNow: (nowMs: number) => session.setNow(nowMs),
    expireCurrentPhase,
    playStep,
    playRound,
    gallery,
  };
}

describe('Pictionary relay-chain contract', () => {
  it('starts rounds whose offsets are a permutation beginning at 0', () => {
    const session = game();
    const { seatOrder, stepOffsets } = session.state;
    expect(stepOffsets).toHaveLength(NUMBER_OF_PLAYERS);
    expect(stepOffsets[0]).toBe(0);
    expect(new Set(stepOffsets).size).toBe(NUMBER_OF_PLAYERS);
    for (let chainIndex = 0; chainIndex < NUMBER_OF_PLAYERS; chainIndex += 1) {
      const authors = stepOffsets.map(
        (offset) => seatOrder[(chainIndex + offset) % NUMBER_OF_PLAYERS],
      );
      expect(authors[0]).toBe(seatOrder[chainIndex]);
      expect(new Set(authors).size).toBe(NUMBER_OF_PLAYERS);
    }
  });

  it('shows each seat only the immediately previous entry of its chain', () => {
    const session = game();
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      const task = getPictionaryTaskForSeat(session.state, seat);
      if (task === null) throw new Error('Missing task');
      expect(task.expectedKind).toBe('text');
      expect(task.previousEntry).toBeNull();
    }
    session.playStep();
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(1);
    const { seatOrder, stepOffsets } = session.state;
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      const task = getPictionaryTaskForSeat(session.state, seat);
      if (task === null) throw new Error('Missing task');
      expect(task.expectedKind).toBe('drawing');
      const seatIndex = seatOrder.indexOf(seat);
      const chainIndex = (seatIndex - stepOffsets[1]! + NUMBER_OF_PLAYERS) % NUMBER_OF_PLAYERS;
      expect(task.chainIndex).toBe(chainIndex);
      const previousAuthor = seatOrder[chainIndex]!;
      expect(task.previousEntry).toMatchObject({
        kind: 'text',
        authorSeat: previousAuthor,
        text: `step-0-seat-${previousAuthor}`,
      });
    }
  });

  it('settles exactly once, when the last entry of the final step lands', () => {
    const session = game();
    for (let step = 0; step < NUMBER_OF_PLAYERS - 1; step += 1) session.playStep();
    session.expireCurrentPhase();
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
      const stepIndex = session.state.stepIndex;
      if (getPictionaryExpectedKind(stepIndex) === 'text') {
        session.send(
          { type: 'pictionary.text.submit', text: `step-${stepIndex}-seat-${seat}` },
          `user-${seat}`,
        );
      } else {
        session.send({ type: 'pictionary.task.empty.submit' }, `user-${seat}`);
      }
    }
    expect(session.state.phase).toBe('transition');
    expect(
      session.effects.filter((effect) => effect.type === 'pictionary.game.completed'),
    ).toHaveLength(1);
    session.expireCurrentPhase();
    expect(session.state.phase).toBe('gallery');
    const completions = session.effects.filter(
      (effect) => effect.type === 'pictionary.game.completed',
    );
    expect(completions).toHaveLength(1);
    // The final step was left empty by every seat, so the roster is
    // earned by the text steps alone: all four seats authored text.
    expect(completions[0]?.payload.participantUserIds).toEqual([
      'user-0',
      'user-1',
      'user-2',
      'user-3',
    ]);
    session.gallery('finish');
    expect(session.state.phase).toBe('ended');
    expect(
      session.effects.filter((effect) => effect.type === 'pictionary.game.completed'),
    ).toHaveLength(1);
  });

  it('freezes and restores gallery timers and keeps the reveal monotonic', () => {
    const session = game(10);
    session.playRound();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({
      chainIndex: 0,
      entryIndex: 0,
      revealedPosition: 0,
      isPlaying: true,
    });
    session.gallery('advance');
    expect(session.state.gallery).toMatchObject({
      chainIndex: 0,
      entryIndex: 1,
      revealedPosition: 1,
    });
    session.gallery('rewind');
    expect(session.state.gallery).toMatchObject({
      chainIndex: 0,
      entryIndex: 0,
      revealedPosition: 1,
    });
    session.gallery('advance');
    const deadlineAt = session.state.deadlineAt;
    if (deadlineAt === null) throw new Error('Missing gallery deadline');
    session.setNow(deadlineAt - 4_000);
    session.gallery('pause');
    expect(session.state.gallery).toMatchObject({ isPlaying: false, remainingMs: 4_000 });
    expect(session.state.deadlineAt).toBeNull();
    session.setNow(deadlineAt + 60_000);
    session.gallery('resume');
    expect(session.state.gallery).toMatchObject({ isPlaying: true, remainingMs: null });
    expect(session.state.deadlineAt).toBe(deadlineAt + 64_000);
    session.gallery('finish');
    expect(session.state.gallery).toMatchObject({
      chainIndex: 3,
      entryIndex: 3,
      revealedPosition: 15,
    });
    expect(session.state.phase).toBe('ended');
  });

  it('rejects resume when the gallery is manually paged', () => {
    const session = game(null);
    session.playRound();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({ isPlaying: false });
    expect(session.decide({ type: 'pictionary.gallery.resume' })).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_GALLERY_MANUAL,
    });
  });

  it('advances phaseRevision only on phase-bearing events', () => {
    const session = game();
    const revision = () => session.state.phaseRevision;
    const afterStart = revision();
    session.send({ type: 'pictionary.task.ready.set', isReady: true });
    expect(revision()).toBe(afterStart);
    session.send({ type: 'pictionary.phase.finish' });
    expect(revision()).toBe(afterStart + 1);
    session.send({ type: 'pictionary.text.submit', text: 'first' });
    expect(revision()).toBe(afterStart + 1);
    for (let seat = 1; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.text.submit', text: `seat-${seat}` }, `user-${seat}`);
    expect(revision()).toBe(afterStart + 2);
    session.expireCurrentPhase();
    expect(revision()).toBe(afterStart + 3);
    session.send({ type: 'pictionary.round.abort' });
    expect(revision()).toBe(afterStart + 4);
    expect(session.state.phase).toBe('aborted');
    session.send({ type: 'pictionary.game.returnToLobby' });
    expect(revision()).toBe(afterStart + 5);
    expect(session.state.phase).toBe('lobby');
  });

  it('never lets a stale-revision command change state', () => {
    const session = game();
    const staleRevision = session.state.phaseRevision;
    session.send({ type: 'pictionary.phase.finish' });
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.text.submit', text: `seat-${seat}` }, `user-${seat}`);
    expect(session.state.phase).toBe('transition');
    const before = session.state;
    // Pictionary's registered difference: a stale expire silently
    // commits empty (its client timer polls on the empty commit).
    const decision = session.decide({
      type: 'pictionary.phase.expire',
      phaseRevision: staleRevision,
    });
    expect(decision.kind).toBe('commit');
    if (decision.kind === 'commit') expect(decision.events).toHaveLength(0);
    session.send({ type: 'pictionary.phase.expire', phaseRevision: staleRevision });
    expect(session.state.phaseRevision).toBe(before.phaseRevision);
    expect(session.state.phase).toBe('transition');
    // A stale phase command (gallery controls carry the revision)
    // rejects instead, through the engine's entry gate.
    const staleGallery: PictionaryCommand = {
      type: 'pictionary.gallery.advance',
      roundId: session.state.roundId,
      phaseRevision: staleRevision,
    };
    const context = session.session.context('user-0');
    expect(session.session.decideAs(staleGallery, context)).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_PHASE_INVALID,
    });
  });

  it('rejects phase.expire from a user who is neither host nor seated', () => {
    const session = game();
    const deadline = session.state.deadlineAt;
    if (deadline === null) throw new Error('Missing answering deadline');
    session.setNow(deadline);
    const before = session.state;
    // Pictionary's other registered difference on the shared guard:
    // the expire actor must be the host or a seated player (Story
    // Relay has no such gate), so an outside user cannot move the
    // phase even once the deadline has passed.
    expect(
      session.decide(
        { type: 'pictionary.phase.expire', phaseRevision: before.phaseRevision },
        'user-99',
      ),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_SEATED });
    expect(session.state.phase).toBe('answering');
    expect(session.state.phaseRevision).toBe(before.phaseRevision);
    // Control: the deadline really is live — the host's expire at
    // the same instant moves the phase forward.
    session.expireCurrentPhase();
    expect(session.state.phase).toBe('settling');
  });

  it('keeps its own submission gates on the shared machine', () => {
    const session = game();
    // Late readiness: the answering deadline has passed.
    const answeringDeadline = session.state.deadlineAt;
    if (answeringDeadline === null) throw new Error('Missing answering deadline');
    session.setNow(answeringDeadline);
    expect(session.decide({ type: 'pictionary.task.ready.set', isReady: true })).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_PHASE_NOT_EXPIRED,
    });
    // Move to the first drawing step (step 1) and settle it.
    session.expireCurrentPhase();
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.text.submit', text: `seat-${seat}` }, `user-${seat}`);
    session.expireCurrentPhase();
    session.expireCurrentPhase();
    expect(session.state.phase).toBe('settling');
    expect(session.state.stepIndex).toBe(1);
    // Kind gate: text cannot land on a drawing step.
    expect(session.decide({ type: 'pictionary.text.submit', text: 'a guess' })).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_TASK_INVALID,
    });
    // Reservation gate: a reserved drawing claims the seat's submission.
    session.send({ type: 'pictionary.drawing.reserve' });
    expect(session.decide({ type: 'pictionary.task.empty.submit' })).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
    });
  });
});

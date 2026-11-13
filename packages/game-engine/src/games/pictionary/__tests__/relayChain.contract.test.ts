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
 * 2026-10-18 ruling); entering the gallery settles nothing. The
 * expiry channel is pinned here too (D3, 2026-11-05 — the public
 * expire command was deleted): the internal settle command only
 * accepts the system actor, so any user actor is rejected, and a
 * settle delivery that arrives after the phase already advanced
 * rejects as not expired — the proposition is that an expired
 * command never changes state.
 *
 * The task projection's move onto the shared machine (E-4 PR-2) is
 * pinned here too: outside the task phases there is no task, so a
 * stale task command is rejected as an invalid task at the entry
 * gate, and a corrupted round (missing chain or previous entry)
 * fails fast instead of projecting null.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_SYSTEM_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import type {
  PictionaryCommand,
  PictionaryCommandInput,
  PictionaryInternalCommand,
} from '../commands/types';
import {
  REASON_PICTIONARY_GALLERY_MANUAL,
  REASON_PICTIONARY_PHASE_EXPIRED,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
  REASON_PICTIONARY_TASK_INVALID,
} from '../domain/reasons';
import { getPictionaryTaskForSeat } from '../domain/visibility';
import { pictionaryEngine } from '../engine';
import { migratePersistedPictionaryState, parsePictionaryState } from '../state/parseState';
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
  send({ type: 'pictionary.game.begin' });

  // D3: the public expire command is deleted; the phase is settled
  // by the internal command on the system channel, as the scheduled
  // settle.due effect dispatches it.
  function expireCurrentPhase() {
    const state = session.state;
    if (state.deadlineAt === null) throw new Error(`Expected ${state.phase} to have a deadline`);
    session.setNow(state.deadlineAt);
    return session.sendAs(
      { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
      session.systemContext('settle'),
    );
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
          replay: null,
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
  it('migrates v9 galleries and drawing metadata without replay', () => {
    const session = game();
    session.playRound();
    const gallery = session.state.gallery;
    if (gallery === null) throw new Error('Missing gallery');
    const { revealStartedAt: _start, revealDurationMs: _duration, ...legacyGallery } = gallery;
    const chains = session.state.chains.map((chain) => ({
      ...chain,
      entries: chain.entries.map((entry) => {
        if (entry.kind !== 'drawing') return entry;
        const { replay: _replay, ...media } = entry.media;
        return { ...entry, media };
      }),
    }));
    const migrated = migratePersistedPictionaryState({
      ...session.state,
      stateVersion: 9,
      chains,
      gallery: legacyGallery,
    });
    expect(migrated.stateVersion).toBe(10);
    expect(migrated.gallery).toEqual({
      ...legacyGallery,
      revealStartedAt: null,
      revealDurationMs: 0,
    });
    expect(
      migrated.chains
        .flatMap((chain) => chain.entries)
        .filter((entry) => entry.kind === 'drawing')
        .every((entry) => entry.media.replay === null),
    ).toBe(true);
  });
  it('anchors the first text in a manual gallery', () => {
    const session = game(null);
    session.playRound();
    expect(session.state.gallery?.revealStartedAt).not.toBeNull();
    expect(session.state.gallery?.revealDurationMs).toBe(1040);
    expect(session.state.deadlineAt).toBeNull();
  });
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
      revealStartedAt: null,
      revealDurationMs: 0,
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
    for (let seat = 1; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.task.ready.set', isReady: true }, `user-${seat}`);
    expect(revision()).toBe(afterStart + 1);
    session.send({ type: 'pictionary.text.submit', text: 'first' });
    expect(revision()).toBe(afterStart + 1);
    for (let seat = 1; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.text.submit', text: `seat-${seat}` }, `user-${seat}`);
    expect(revision()).toBe(afterStart + 2);
    session.expireCurrentPhase();
    expect(revision()).toBe(afterStart + 3);
    session.send({ type: 'pictionary.game.abort' });
    expect(revision()).toBe(afterStart + 4);
    expect(session.state.phase).toBe('aborted');
    session.send({ type: 'pictionary.game.returnToLobby' });
    expect(revision()).toBe(afterStart + 5);
    expect(session.state.phase).toBe('lobby');
  });

  it('rejects stale-revision commands and late settle deliveries', () => {
    const session = game();
    const staleRevision = session.state.phaseRevision;
    session.expireCurrentPhase();
    expect(session.state.phase).toBe('settling');
    const beforeSettle = session.state;
    // D3: the internal settle command carries no revision, so there
    // is no stale-revision expire anymore. What is still true is
    // that a settle delivery arriving after the phase already
    // advanced changes nothing: the settling phase carries no
    // deadline, so the guard rejects it as not expired.
    expect(
      session.session.decideAs(
        { type: 'pictionary.phase.settleExpired' } satisfies PictionaryCommand,
        session.session.systemContext('settle'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_PICTIONARY_PHASE_NOT_EXPIRED });
    expect(session.state.phaseRevision).toBe(beforeSettle.phaseRevision);
    expect(session.state.phase).toBe('settling');
    for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1)
      session.send({ type: 'pictionary.text.submit', text: `seat-${seat}` }, `user-${seat}`);
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

  it('rejects settleExpired from any user actor — the channel is system-only', () => {
    const session = game();
    const deadline = session.state.deadlineAt;
    if (deadline === null) throw new Error('Missing answering deadline');
    session.setNow(deadline);
    const before = session.state;
    // D3 (2026-11-05): the public expire channel is deleted and
    // the D1' host-or-seated gate died with it. The internal settle
    // command only accepts the system actor, so every user — the
    // host, a seated player, and a spectator alike — is rejected
    // the same way, and the phase never moves.
    for (const userId of ['user-99', 'user-0', 'user-1']) {
      expect(session.decide({ type: 'pictionary.phase.settleExpired' }, userId)).toEqual({
        kind: 'reject',
        reason: REASON_SYSTEM_ACTOR_REQUIRED,
      });
    }
    expect(session.state.phaseRevision).toBe(before.phaseRevision);
    expect(session.state.phase).toBe(before.phase);
  });

  it('keeps its own submission gates on the shared machine', () => {
    const session = game();
    // Late readiness: the answering deadline has passed, so the
    // shared machine's deadline gate rejects with the dedicated
    // expired reason (not the not-expired reason a premature
    // settle delivery gets).
    const answeringDeadline = session.state.deadlineAt;
    if (answeringDeadline === null) throw new Error('Missing answering deadline');
    session.setNow(answeringDeadline);
    expect(session.decide({ type: 'pictionary.task.ready.set', isReady: true })).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_PHASE_EXPIRED,
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

  it('rejects a task command sent in the gallery as an invalid task', () => {
    const session = game();
    session.playRound();
    expect(session.state.phase).toBe('gallery');
    // The identity below is the one seat 0's client bound at the
    // final step: entering the gallery changes neither round nor
    // step, and the seat's chain is the one it authored on. The
    // machine projection has no task outside the task phases, so
    // the entry gate rejects the stale command as an invalid task
    // instead of passing it through to the machine's phase gate.
    const state = session.state;
    if (state.roundId === null) throw new Error('Missing round id');
    const seatIndex = state.seatOrder.indexOf(0);
    const chainIndex =
      (seatIndex - state.stepOffsets[state.stepIndex]! + NUMBER_OF_PLAYERS) % NUMBER_OF_PLAYERS;
    const chain = state.chains[chainIndex];
    if (chain === undefined) throw new Error('Missing chain');
    const staleTaskCommand: PictionaryCommand = {
      type: 'pictionary.text.submit',
      text: 'too late',
      roundId: state.roundId,
      stepIndex: state.stepIndex,
      chainId: chain.id,
    };
    const context = session.session.context('user-0');
    expect(session.session.decideAs(staleTaskCommand, context)).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_TASK_INVALID,
    });
  });

  it('fails fast when the projected chain is missing', () => {
    const session = game();
    const corrupted: PictionaryState = { ...session.state, chains: [] };
    expect(() => getPictionaryTaskForSeat(corrupted, 0)).toThrow('Relay task chain missing');
  });

  it('fails fast when the previous entry is missing', () => {
    const session = game();
    session.playStep();
    expect(session.state.stepIndex).toBe(1);
    const corrupted: PictionaryState = {
      ...session.state,
      chains: session.state.chains.map((chain) => ({ ...chain, entries: [] })),
    };
    expect(() => getPictionaryTaskForSeat(corrupted, 0)).toThrow('Relay previous entry missing');
  });
});

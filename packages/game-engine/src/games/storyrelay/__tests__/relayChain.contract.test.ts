/**
 * Relay Chain — Story Relay assembly contract (E1).
 *
 * Story Relay runs on the shared relay machine
 * (platform/room/relay); this file pins the machine's contract
 * propositions against the real Story Relay engine, driven only
 * through authoritative commands: rotation invariants, the task
 * privacy boundary, gallery timer/reveal behavior, and the phase
 * revision contract.
 */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import type { StoryRelayCommand, StoryRelayTaskIdentity } from '../commands/types';
import { getStoryRelayTaskForSeat } from '../domain/relay';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/parseState';
import { DEFAULT_STORY_RELAY_CONFIG } from '../state/types';

const NUMBER_OF_PLAYERS = 4;

function game(galleryItemDurationSeconds: 10 | null = 10) {
  const session = createEngineSession(storyRelayEngine, {
    config: {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: NUMBER_OF_PLAYERS,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds,
    },
    parse: parseStoryRelayState,
    randomSeed: 'round',
  });
  const send = (command: StoryRelayCommand, controlledSeat: number | null = null) =>
    session.send(command, 'host', controlledSeat);
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });

  function taskIdentity(seat: number): StoryRelayTaskIdentity {
    const task = getStoryRelayTaskForSeat(session.state, seat);
    if (task === null) throw new Error('Missing task');
    return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
  }

  return {
    get state() {
      return session.state;
    },
    send,
    setNow: (nowMs: number) => session.setNow(nowMs),
    expectReject: (command: StoryRelayCommand, reason: string) =>
      session.expectReject(command, reason, 'host'),
    taskIdentity,
    finish() {
      return send({
        type: 'storyrelay.phase.finish',
        phaseRevision: session.state.phaseRevision,
      });
    },
    expire() {
      if (session.state.deadlineAt === null) throw new Error('Missing deadline');
      session.setNow(session.state.deadlineAt);
      return send({
        type: 'storyrelay.phase.expire',
        phaseRevision: session.state.phaseRevision,
      });
    },
    submit(seat: number, text: string) {
      return send(
        { type: 'storyrelay.text.submit', ...taskIdentity(seat), text },
        seat === 0 ? null : seat,
      );
    },
    gallery(command: 'pause' | 'resume' | 'advance' | 'rewind' | 'finish') {
      return send({
        type: `storyrelay.gallery.${command}`,
        phaseRevision: session.state.phaseRevision,
      });
    },
    playRound() {
      for (let step = 0; step < NUMBER_OF_PLAYERS; step += 1) {
        this.finish();
        for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1)
          this.submit(seat, `step-${step}-seat-${seat}`);
        this.expire();
      }
    },
  };
}

describe('Story Relay relay-chain contract', () => {
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
    for (let step = 0; step < NUMBER_OF_PLAYERS; step += 1) {
      if (step > 0) {
        for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
          const task = getStoryRelayTaskForSeat(session.state, seat);
          if (task === null) throw new Error('Missing task');
          const seatIndex = session.state.seatOrder.indexOf(seat);
          const chainIndex =
            (seatIndex - session.state.stepOffsets[step]! + NUMBER_OF_PLAYERS) % NUMBER_OF_PLAYERS;
          const previousAuthor =
            session.state.seatOrder[
              (chainIndex + session.state.stepOffsets[step - 1]!) % NUMBER_OF_PLAYERS
            ]!;
          expect(task.previousEntry).toEqual({
            kind: 'text',
            text: `step-${step - 1}-seat-${previousAuthor}`,
          });
          expect(Object.keys(task.previousEntry!).sort()).toEqual(['kind', 'text']);
        }
      }
      session.finish();
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1)
        session.submit(seat, `step-${step}-seat-${seat}`);
      session.expire();
    }
    expect(session.state.phase).toBe('gallery');
  });

  it('freezes and restores gallery timers and keeps the reveal monotonic', () => {
    const session = game(10);
    session.playRound();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({
      position: 0,
      revealedPosition: 0,
      isPlaying: true,
    });
    session.gallery('advance');
    expect(session.state.gallery).toMatchObject({ position: 1, revealedPosition: 1 });
    session.gallery('rewind');
    expect(session.state.gallery).toMatchObject({ position: 0, revealedPosition: 1 });
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
    expect(session.state.gallery).toMatchObject({ position: 15, revealedPosition: 15 });
    expect(session.state.phase).toBe('ended');
  });

  it('rejects resume when the gallery is manually paged', () => {
    const session = game(null);
    session.playRound();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({ isPlaying: false });
    session.expectReject(
      { type: 'storyrelay.gallery.resume', phaseRevision: session.state.phaseRevision },
      'storyrelay_manual_paging',
    );
  });

  it('advances phaseRevision only on phase-bearing events and rejects stale revisions', () => {
    const session = game();
    const revision = () => session.state.phaseRevision;
    const afterStart = revision();
    session.send(
      { type: 'storyrelay.task.ready.set', ...session.taskIdentity(0), isReady: true },
      null,
    );
    expect(revision()).toBe(afterStart);
    session.finish();
    expect(revision()).toBe(afterStart + 1);
    session.submit(0, 'first');
    expect(revision()).toBe(afterStart + 1);
    for (let seat = 1; seat < NUMBER_OF_PLAYERS; seat += 1) session.submit(seat, `seat-${seat}`);
    expect(revision()).toBe(afterStart + 2);
    const before = session.state;
    session.expectReject(
      { type: 'storyrelay.phase.expire', phaseRevision: afterStart },
      'storyrelay_task_changed',
    );
    expect(session.state).toBe(before);
    session.expire();
    expect(revision()).toBe(afterStart + 3);
    session.send({ type: 'storyrelay.game.abort', phaseRevision: revision() });
    expect(revision()).toBe(afterStart + 4);
    expect(session.state.phase).toBe('aborted');
    session.send({ type: 'storyrelay.game.returnToLobby' });
    expect(revision()).toBe(afterStart + 5);
    expect(session.state.phase).toBe('lobby');
  });
});

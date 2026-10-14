/** Exercises Story Relay through authoritative commands, never injecting progressed state. */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import type { StoryRelayCommand } from '../commands/types';
import { getStoryRelayTaskForSeat } from '../domain/relay';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/parseState';
import { DEFAULT_STORY_RELAY_CONFIG } from '../state/types';

function game(numberOfPlayers = 4, galleryItemDurationSeconds: 10 | null = null) {
  const session = createEngineSession(storyRelayEngine, {
    config: {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds,
    },
    parse: parseStoryRelayState,
    randomSeed: 'round',
  });
  const send = (command: StoryRelayCommand, seat: number | null = null) =>
    session.send(command, 'host', seat);
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.round.start' });
  return {
    get state() {
      return session.state;
    },
    effects: session.effects,
    context: (seat: number | null = null) => session.context('host', seat),
    send,
    advanceTime(milliseconds: number) {
      session.advance(milliseconds);
    },
    task(seat: number) {
      const task = getStoryRelayTaskForSeat(session.state, seat);
      if (task === null) throw new Error('Missing task');
      return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
    },
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
  };
}

describe('Story Relay engine', () => {
  it.each([4, 5, 6, 20])(
    'completes exactly %i turns and rewards only participating humans',
    (numberOfPlayers) => {
      const session = game(numberOfPlayers);
      expect(session.state.startedAt).toBe(1000);
      for (let stepIndex = 0; stepIndex < numberOfPlayers; stepIndex += 1) {
        expect(session.state.stepIndex).toBe(stepIndex);
        for (let seat = 0; seat < numberOfPlayers; seat += 1) {
          const task = getStoryRelayTaskForSeat(session.state, seat)!;
          expect(task).not.toHaveProperty('chain');
          expect(task.previousEntry === null).toBe(stepIndex === 0);
          if (task.previousEntry !== null)
            expect(Object.keys(task.previousEntry).sort()).toEqual(['kind', 'text']);
        }
        session.finish();
        for (let seat = 0; seat < numberOfPlayers; seat += 1)
          session.send(
            {
              type: 'storyrelay.text.submit',
              ...session.task(seat),
              text: `  turn ${stepIndex}\nseat ${seat}  `,
            },
            seat === 0 ? null : seat,
          );
        expect(session.state.phase).toBe('transition');
        expect(session.effects).toHaveLength(stepIndex === numberOfPlayers - 1 ? 1 : 0);
        session.expire();
      }
      expect(session.state.phase).toBe('gallery');
      expect(session.state.chains).toHaveLength(numberOfPlayers);
      for (const chain of session.state.chains) {
        expect(chain.entries).toHaveLength(numberOfPlayers);
        expect(new Set(chain.entries.map((entry) => entry.authorSeat)).size).toBe(numberOfPlayers);
        expect(chain.entries[0]).toMatchObject({
          kind: 'text',
          text: `  turn 0\nseat ${chain.originSeat}  `,
        });
      }
      expect(session.effects[0]!.payload.participantUserIds).toEqual(['host']);
      session.send({
        type: 'storyrelay.gallery.advance',
        phaseRevision: session.state.phaseRevision,
      });
      session.send({
        type: 'storyrelay.gallery.rewind',
        phaseRevision: session.state.phaseRevision,
      });
      expect(session.state.gallery).toMatchObject({ position: 0, revealedPosition: 1 });
      session.send({
        type: 'storyrelay.gallery.finish',
        phaseRevision: session.state.phaseRevision,
      });
      expect(session.state.phase).toBe('ended');
      expect(session.effects).toHaveLength(1);
      session.send({ type: 'storyrelay.round.next' });
      expect(session.state).toMatchObject({ phase: 'answering', stepIndex: 0, completedAt: null });
      expect(session.state.chains.every((chain) => chain.entries.length === 0)).toBe(true);
    },
  );

  it('collects empty tasks and rejects duplicate and late submissions', () => {
    const session = game();
    const oldTask = session.task(1);
    session.finish();
    session.send({ type: 'storyrelay.task.empty.submit', ...session.task(0) });
    expect(session.state.phase).toBe('settling');
    session.send({ type: 'storyrelay.task.empty.submit', ...oldTask }, 1);
    expect(
      storyRelayEngine.decide(
        session.state,
        { type: 'storyrelay.text.submit', ...oldTask, text: 'late' },
        session.context(1),
      ).kind,
    ).toBe('reject');
    for (const seat of [2, 3])
      session.send({ type: 'storyrelay.task.empty.submit', ...session.task(seat) }, seat);
    expect(
      session.state.chains
        .flatMap((chain) => chain.entries)
        .map((entry) => entry.kind)
        .sort(),
    ).toEqual(['empty', 'empty', 'empty', 'empty']);
    session.expire();
    expect(
      storyRelayEngine.decide(
        session.state,
        { type: 'storyrelay.task.ready.set', ...oldTask, isReady: true },
        session.context(1),
      ).kind,
    ).toBe('reject');
    expect(getStoryRelayTaskForSeat(session.state, 0)!.previousEntry!.kind).toBe('empty');
    session.send({ type: 'storyrelay.round.abort', phaseRevision: session.state.phaseRevision });
    expect(session.state.phase).toBe('aborted');
    expect(session.effects).toHaveLength(0);
  });

  it('moves to settling only when all seats are ready and rejects invalid or unauthorized text', () => {
    const session = game();
    session.send({ type: 'storyrelay.task.ready.set', ...session.task(0), isReady: true });
    session.send({ type: 'storyrelay.task.ready.set', ...session.task(0), isReady: false });
    expect(session.state.readySeats).toEqual([]);
    for (let seat = 0; seat < 4; seat += 1)
      session.send(
        { type: 'storyrelay.task.ready.set', ...session.task(seat), isReady: true },
        seat === 0 ? null : seat,
      );
    expect(session.state.phase).toBe('settling');
    for (const text of ['   ', 'x'.repeat(513)])
      expect(
        storyRelayEngine.decide(
          session.state,
          { type: 'storyrelay.text.submit', ...session.task(0), text },
          session.context(),
        ).kind,
      ).toBe('reject');
    expect(
      storyRelayEngine.decide(
        session.state,
        { type: 'storyrelay.text.submit', ...session.task(0), text: 'impersonation' },
        session.context(0),
      ).kind,
    ).toBe('reject');
  });

  it('preserves remaining playback time across pause and resume', () => {
    const session = game(4, 10);
    for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
      session.finish();
      session.send({ type: 'storyrelay.task.empty.submit', ...session.task(0) });
      for (const seat of [1, 2, 3])
        session.send({ type: 'storyrelay.task.empty.submit', ...session.task(seat) }, seat);
      session.expire();
    }
    session.advanceTime(3000);
    session.send({ type: 'storyrelay.gallery.pause', phaseRevision: session.state.phaseRevision });
    expect(session.state.gallery!.remainingMs).toBe(7000);
    session.advanceTime(5000);
    session.send({ type: 'storyrelay.gallery.resume', phaseRevision: session.state.phaseRevision });
    expect(session.state.deadlineAt).toBe(session.context().nowMs + 7000);
  });
});

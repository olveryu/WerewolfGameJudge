/** Exercises Story Relay through authoritative commands, never injecting progressed state. */

import type { CommandContext } from '../../../platform/engine';
import type { StoryRelayCommand } from '../commands/types';
import type { StoryRelayEffect } from '../domain/decision';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/codec';
import { DEFAULT_STORY_RELAY_CONFIG, getStoryRelayTaskForSeat } from '../state/types';

function game(numberOfPlayers = 4, galleryItemDurationSeconds: 10 | null = null) {
  let nowMs = 1000;
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds,
    },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const effects: StoryRelayEffect[] = [];
  const context = (seat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: seat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const send = (command: StoryRelayCommand, seat: number | null = null) => {
    const decision = storyRelayEngine.decide(state, command, context(seat));
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
    effects.push(...decision.effects);
    return state;
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.round.start' });
  return {
    get state() {
      return state;
    },
    effects,
    context,
    send,
    advanceTime(milliseconds: number) {
      nowMs += milliseconds;
    },
    task(seat: number) {
      const task = getStoryRelayTaskForSeat(state, seat);
      if (task === null) throw new Error('Missing task');
      return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
    },
    finish() {
      return send({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision });
    },
    expire() {
      if (state.deadlineAt === null) throw new Error('Missing deadline');
      nowMs = state.deadlineAt;
      return send({ type: 'storyrelay.phase.expire', phaseRevision: state.phaseRevision });
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

  it('distinguishes empty, missing and explicitly skipped tasks and rejects late submissions', () => {
    const session = game();
    const oldTask = session.task(1);
    session.finish();
    session.send({ type: 'storyrelay.task.empty.submit', ...session.task(0) });
    expect(session.state.phase).toBe('settling');
    session.send({
      type: 'storyrelay.task.skip',
      ...oldTask,
      seat: 1,
      phaseRevision: session.state.phaseRevision,
    });
    expect(
      storyRelayEngine.decide(
        session.state,
        { type: 'storyrelay.text.submit', ...oldTask, text: 'late' },
        session.context(1),
      ).kind,
    ).toBe('reject');
    session.send({
      type: 'storyrelay.bots.skip',
      roundId: session.state.roundId!,
      stepIndex: session.state.stepIndex,
      phaseRevision: session.state.phaseRevision,
    });
    expect(
      session.state.chains
        .flatMap((chain) => chain.entries)
        .map((entry) => entry.kind)
        .sort(),
    ).toEqual(['empty', 'skipped', 'skipped', 'skipped']);
    session.expire();
    expect(
      storyRelayEngine.decide(
        session.state,
        { type: 'storyrelay.task.ready.set', ...oldTask, isReady: true },
        session.context(1),
      ).kind,
    ).toBe('reject');
    expect(getStoryRelayTaskForSeat(session.state, 0)!.previousEntry!.kind).toBe('skipped');
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
      session.send({
        type: 'storyrelay.bots.skip',
        roundId: session.state.roundId!,
        stepIndex,
        phaseRevision: session.state.phaseRevision,
      });
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

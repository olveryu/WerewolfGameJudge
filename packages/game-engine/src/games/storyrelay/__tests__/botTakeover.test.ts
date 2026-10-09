/**
 * Bot-takeover submissions: an unseated host writes drafts for bot seats through
 * controlledSeat. Exercises authoritative commands only, never injecting state.
 */

import type { CommandContext } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
} from '../../../platform/protocol/reasons';
import type { StoryRelayCommand } from '../commands/types';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/codec';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayBotSeats,
  getStoryRelayTaskForSeat,
} from '../state/types';

/** Mirrors the e2e setup: the host never takes a seat, all seats are filled with bots. */
function botGame(seatHost: boolean) {
  const nowMs = 1000;
  let commandNumber = 0;
  let state = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: 4,
      transitionDurationSeconds: 0,
    },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const context = (actorUserId: string, controlledSeat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId: actorUserId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const decide = (
    command: StoryRelayCommand,
    actorUserId = 'host',
    controlledSeat: number | null = null,
  ) => storyRelayEngine.decide(state, command, context(actorUserId, controlledSeat));
  const send = (
    command: StoryRelayCommand,
    actorUserId = 'host',
    controlledSeat: number | null = null,
  ) => {
    const decision = decide(command, actorUserId, controlledSeat);
    if (decision.kind === 'reject') throw new Error(decision.reason);
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
    return state;
  };
  if (seatHost) send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.round.start' });
  // Host ends the writing step, like tapping finish-step in the UI; the phase
  // becomes settling, which is when text submissions are accepted.
  send({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision });
  return {
    get state() {
      return state;
    },
    decide,
    send,
    task(seat: number) {
      const task = getStoryRelayTaskForSeat(state, seat);
      if (task === null) throw new Error('Missing task');
      return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
    },
  };
}

describe('Story Relay bot takeover', () => {
  it('lets an unseated host submit independent texts for every bot seat', () => {
    const session = botGame(false);
    expect(getStoryRelayBotSeats(session.state)).toEqual([0, 1, 2, 3]);

    for (let seat = 0; seat < 4; seat += 1) {
      session.send(
        {
          type: 'storyrelay.text.submit',
          ...session.task(seat),
          text: `机器人${seat}的独立稿件`,
        },
        'host',
        seat,
      );
    }

    expect(session.state.phase).toBe('transition');
    for (const chain of session.state.chains) {
      expect(chain.entries).toHaveLength(1);
      const entry = chain.entries[0]!;
      expect(entry.kind).toBe('text');
      if (entry.kind !== 'text') throw new Error('Expected a text entry');
      expect(entry.authorSeat).toBe(chain.originSeat);
      expect(entry.text).toBe(`机器人${chain.originSeat}的独立稿件`);
    }
  });

  it('rejects controlled-seat submissions from a non-host actor', () => {
    const session = botGame(false);
    const decision = session.decide(
      {
        type: 'storyrelay.text.submit',
        ...session.task(0),
        text: 'intruder draft',
      },
      'intruder',
      0,
    );

    expect(decision.kind).toBe('reject');
    if (decision.kind !== 'reject') throw new Error('Expected rejection');
    expect(decision.reason).toBe(REASON_NOT_HOST);
  });

  it('rejects controlled-seat submissions targeting a real seat', () => {
    const session = botGame(true);
    expect(getStoryRelayBotSeats(session.state)).toEqual([1, 2, 3]);
    const decision = session.decide(
      {
        type: 'storyrelay.text.submit',
        ...session.task(0),
        text: 'host draft for own seat via takeover',
      },
      'host',
      0,
    );

    expect(decision.kind).toBe('reject');
    if (decision.kind !== 'reject') throw new Error('Expected rejection');
    expect(decision.reason).toBe(REASON_CONTROLLED_SEAT_NOT_BOT);
  });

  it('preserves submitted fragments when the host aborts the round', () => {
    const session = botGame(false);
    for (let seat = 0; seat < 4; seat += 1) {
      session.send(
        {
          type: 'storyrelay.text.submit',
          ...session.task(seat),
          text: `机器人${seat}的独立稿件`,
        },
        'host',
        seat,
      );
    }

    session.send({ type: 'storyrelay.round.abort', phaseRevision: session.state.phaseRevision });

    expect(session.state.phase).toBe('aborted');
    expect(session.state.chains).toHaveLength(4);
    for (const chain of session.state.chains) {
      expect(chain.entries).toHaveLength(1);
      const entry = chain.entries[0]!;
      expect(entry.kind).toBe('text');
      if (entry.kind !== 'text') throw new Error('Expected a text entry');
      expect(entry.text).toBe(`机器人${chain.originSeat}的独立稿件`);
    }
  });
});

describe('Story Relay unified roster rules', () => {
  function lobbyWithBots(numberOfPlayers = 4) {
    let state = storyRelayEngine.createInitialState(
      { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers, transitionDurationSeconds: 0 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
    );
    const context = (actorUserId: string): CommandContext => ({
      actor: { kind: 'user', userId: actorUserId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: 'test',
      randomSeed: 'round',
    });
    const send = (command: StoryRelayCommand, actorUserId = 'host') => {
      const decision = storyRelayEngine.decide(state, command, context(actorUserId));
      if (decision.kind === 'reject') throw new Error(decision.reason);
      state = storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state));
      return state;
    };
    send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    send({ type: 'room.seat.fillBots' });
    return {
      get state() {
        return state;
      },
      decide: (command: StoryRelayCommand, actorUserId = 'host') =>
        storyRelayEngine.decide(state, command, context(actorUserId)),
    };
  }

  it('rejects a human taking a bot seat (bots occupy seats like any player)', () => {
    const session = lobbyWithBots();
    expect(getStoryRelayBotSeats(session.state)).toEqual([1, 2, 3]);
    const decision = session.decide(
      { type: 'room.seat.take', seat: 2, profile: { displayName: 'Guest' } },
      'guest',
    );
    expect(decision).toEqual({ kind: 'reject', reason: 'seat_taken' });
  });

  it('rejects a config shrink that would strand a bot seat', () => {
    const session = lobbyWithBots(5);
    expect(getStoryRelayBotSeats(session.state)).toEqual([1, 2, 3, 4]);
    const decision = session.decide({
      type: 'storyrelay.config.update',
      config: { ...session.state.config, numberOfPlayers: 4 },
    });
    expect(decision.kind).toBe('reject');
    if (decision.kind !== 'reject') throw new Error('Expected rejection');
    expect(decision.reason).toBe('目标人数之外的座位仍有玩家入座，请先让这些玩家离座或换到空位');
  });
});

/**
 * Settle arming invariant — Story Relay (phase-expiry redesign §5.1).
 *
 * Every decision that writes a deadline returns exactly one settle.due
 * effect whose pin equals the evolved state's phase identity; every
 * decision that writes no deadline (settling, pause, finish, ended)
 * returns none. Driven only through authoritative commands, with the
 * state JSON-round-tripped through the game's own parser after each
 * decision, so a pin can only match states the persistence layer
 * would accept.
 */

import { describe, expect, it } from 'vitest';

import type { CommandContext } from '../../../platform/engine';
import { REASON_SYSTEM_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import type { StoryRelayCommand } from '../commands/types';
import type { StoryRelayDecision, StoryRelayEffect } from '../domain/decision';
import { getStoryRelayTaskForSeat } from '../domain/relay';
import { storyRelayEngine } from '../engine';
import { parseStoryRelayState } from '../state/parseState';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  type StoryRelayConfig,
  type StoryRelayState,
} from '../state/types';

type SettleEffect = Extract<StoryRelayEffect, { type: 'storyrelay.settle.due' }>;

const NUMBER_OF_PLAYERS = 4;

interface DriverOptions {
  readonly writingDurationSeconds?: StoryRelayConfig['writingDurationSeconds'];
  readonly galleryItemDurationSeconds?: StoryRelayConfig['galleryItemDurationSeconds'];
}

function driver(options: DriverOptions = {}) {
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    {
      ...DEFAULT_STORY_RELAY_CONFIG,
      numberOfPlayers: NUMBER_OF_PLAYERS,
      transitionDurationSeconds: 3,
      galleryItemDurationSeconds:
        options.galleryItemDurationSeconds !== undefined ? options.galleryItemDurationSeconds : 10,
      writingDurationSeconds:
        options.writingDurationSeconds !== undefined
          ? options.writingDurationSeconds
          : DEFAULT_STORY_RELAY_CONFIG.writingDurationSeconds,
    },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  let commandNumber = 0;
  let nowMs = 1000;

  const context = (controlledSeat: number | null, actorUserId = 'host'): CommandContext => ({
    actor: { kind: 'user', userId: actorUserId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });
  const systemContext = (): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'round',
  });

  const decide = (command: StoryRelayCommand, ctx: CommandContext): StoryRelayDecision => {
    const decision = storyRelayEngine.decide(state, command, ctx);
    if (decision.kind === 'commit') {
      state = parseStoryRelayState(
        JSON.parse(
          JSON.stringify(
            storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
          ),
        ),
      );
    }
    return decision;
  };
  const send = (command: StoryRelayCommand, controlledSeat: number | null = null) => {
    const decision = decide(command, context(controlledSeat));
    if (decision.kind !== 'commit') throw new Error(`rejected: ${decision.reason}`);
    return decision;
  };
  const taskIdentity = (seat: number) => {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error('Missing task');
    return { roundId: task.roundId, stepIndex: task.stepIndex, chainId: task.chainId };
  };
  const settleOf = (decision: StoryRelayDecision): readonly SettleEffect[] => {
    if (decision.kind !== 'commit') throw new Error(`rejected: ${decision.reason}`);
    return decision.effects.filter(
      (effect): effect is SettleEffect => effect.type === 'storyrelay.settle.due',
    );
  };
  const expectPinMatchesState = (decision: StoryRelayDecision) => {
    const settled = settleOf(decision);
    expect(settled).toHaveLength(1);
    expect(settled[0]!.payload).toEqual({
      roundId: state.roundId,
      phaseRevision: state.phaseRevision,
      stepIndex: state.stepIndex,
      deadlineAt: state.deadlineAt,
    });
    return settled[0]!;
  };

  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });

  return {
    get state() {
      return state;
    },
    setNow(value: number) {
      nowMs = value;
    },
    get now() {
      return nowMs;
    },
    begin() {
      return send({ type: 'storyrelay.game.begin' });
    },
    decide,
    systemContext,
    settleOf,
    expectPinMatchesState,
    readyAll() {
      let last: StoryRelayDecision | null = null;
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        last = send(
          { type: 'storyrelay.task.ready.set', ...taskIdentity(seat), isReady: true },
          seat === 0 ? null : seat,
        );
      }
      return last!;
    },
    submitAll(step: number) {
      let last: StoryRelayDecision | null = null;
      for (let seat = 0; seat < NUMBER_OF_PLAYERS; seat += 1) {
        last = send(
          {
            type: 'storyrelay.text.submit',
            ...taskIdentity(seat),
            text: `step-${step}-seat-${seat}`,
          },
          seat === 0 ? null : seat,
        );
      }
      return last!;
    },
    expire() {
      if (state.deadlineAt === null) throw new Error('Missing deadline');
      nowMs = state.deadlineAt;
      return send({ type: 'storyrelay.phase.expire', phaseRevision: state.phaseRevision });
    },
    expireSettle() {
      if (state.deadlineAt === null) throw new Error('Missing deadline');
      nowMs = state.deadlineAt;
      return decide({ type: 'storyrelay.phase.settleExpired' }, systemContext());
    },
    gallery(command: 'pause' | 'resume' | 'advance' | 'rewind' | 'finish') {
      return send({
        type: `storyrelay.gallery.${command}`,
        phaseRevision: state.phaseRevision,
      });
    },
    playStep(step: number) {
      this.readyAll();
      this.submitAll(step);
      return this.expire();
    },
  };
}

describe('Story Relay settle arming', () => {
  it('arms exactly one settle effect at round start, pinned to the evolved state', () => {
    const session = driver();
    const decision = session.begin();
    expect(session.state.phase).toBe('answering');
    expect(session.state.deadlineAt).toBe(1000 + 90_000);
    session.expectPinMatchesState(decision);
  });

  it('arms nothing when writing is unlimited', () => {
    const session = driver({ writingDurationSeconds: null });
    const decision = session.begin();
    expect(session.state.deadlineAt).toBeNull();
    expect(session.settleOf(decision)).toHaveLength(0);
  });

  it('arms nothing on the ready-all transition into settling', () => {
    const session = driver();
    session.begin();
    const decision = session.readyAll();
    expect(session.state.phase).toBe('settling');
    expect(session.state.deadlineAt).toBeNull();
    expect(session.settleOf(decision)).toHaveLength(0);
  });

  it('arms the transition deadline when the last entry lands', () => {
    const session = driver();
    session.begin();
    session.readyAll();
    const decision = session.submitAll(0);
    expect(session.state.phase).toBe('transition');
    expect(session.state.deadlineAt).toBe(1000 + 3_000);
    session.expectPinMatchesState(decision);
  });

  it('arms the next answering step when a transition expires', () => {
    const session = driver();
    session.begin();
    session.readyAll();
    session.submitAll(0);
    const decision = session.expire();
    expect(session.state.phase).toBe('answering');
    expect(session.state.stepIndex).toBe(1);
    expect(session.state.deadlineAt).toBe(4000 + 90_000);
    session.expectPinMatchesState(decision);
  });

  it('arms nothing when an answering phase expires into settling', () => {
    const session = driver();
    session.begin();
    const decision = session.expire();
    expect(session.state.phase).toBe('settling');
    expect(session.state.deadlineAt).toBeNull();
    expect(session.settleOf(decision)).toHaveLength(0);
  });

  it('settles through the internal command as the system actor, and rejects a user actor', () => {
    const session = driver();
    session.begin();
    const decision = session.expireSettle();
    expect(decision.kind).toBe('commit');
    expect(session.state.phase).toBe('settling');

    const second = driver();
    second.begin();
    const userDecision = second.decide(
      { type: 'storyrelay.phase.settleExpired' },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: null,
        nowMs: second.state.deadlineAt ?? 0,
        commandId: 'command:user-settle',
        randomSeed: 'round',
      },
    );
    expect(userDecision).toEqual({ kind: 'reject', reason: REASON_SYSTEM_ACTOR_REQUIRED });
    expect(second.state.phase).toBe('answering');
  });

  it('arms the gallery deadline when a completed round expires into the gallery', () => {
    const session = driver();
    session.begin();
    for (let step = 0; step < NUMBER_OF_PLAYERS - 1; step += 1) session.playStep(step);
    session.readyAll();
    session.submitAll(NUMBER_OF_PLAYERS - 1);
    expect(session.state.phase).toBe('transition');
    const galleryDecision = session.expire();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({ position: 0, isPlaying: true });
    expect(session.state.deadlineAt).toBe(session.now + 10_000);
    session.expectPinMatchesState(galleryDecision);
  });

  it('arms gallery advance and resume, and nothing on pause or finish', () => {
    const session = driver();
    session.begin();
    for (let step = 0; step < NUMBER_OF_PLAYERS; step += 1) session.playStep(step);
    expect(session.state.phase).toBe('gallery');
    expect(session.state.gallery).toMatchObject({ position: 0, isPlaying: true });

    const advanced = session.gallery('advance');
    expect(session.state.gallery).toMatchObject({ position: 1 });
    session.expectPinMatchesState(advanced);

    const deadlineAt = session.state.deadlineAt;
    if (deadlineAt === null) throw new Error('Missing gallery deadline');
    session.setNow(deadlineAt - 4_000);
    const paused = session.gallery('pause');
    expect(session.state.gallery).toMatchObject({ isPlaying: false, remainingMs: 4_000 });
    expect(session.state.deadlineAt).toBeNull();
    expect(session.settleOf(paused)).toHaveLength(0);

    session.setNow(deadlineAt + 60_000);
    const resumed = session.gallery('resume');
    expect(session.state.gallery).toMatchObject({ isPlaying: true, remainingMs: null });
    expect(session.state.deadlineAt).toBe(deadlineAt + 64_000);
    session.expectPinMatchesState(resumed);

    const finished = session.gallery('finish');
    expect(session.state.phase).toBe('ended');
    expect(session.settleOf(finished)).toHaveLength(0);
  });

  it('arms nothing for a manual gallery', () => {
    const session = driver({ galleryItemDurationSeconds: null });
    session.begin();
    for (let step = 0; step < NUMBER_OF_PLAYERS - 1; step += 1) session.playStep(step);
    session.readyAll();
    session.submitAll(NUMBER_OF_PLAYERS - 1);
    const decision = session.expire();
    expect(session.state.phase).toBe('gallery');
    expect(session.state.deadlineAt).toBeNull();
    expect(session.settleOf(decision)).toHaveLength(0);
    const advanced = session.gallery('advance');
    expect(session.settleOf(advanced)).toHaveLength(0);
  });
});

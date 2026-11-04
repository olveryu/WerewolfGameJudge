/** Story Relay Worker settle effect: scheduled settlement of an armed deadline through the shared settle.due delivery chain. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  STORY_RELAY_REASONS,
  STORY_RELAY_STATE_CODEC,
  type StoryRelayCommand,
  type StoryRelayEffect,
  storyRelayEngine,
  type StoryRelayInternalCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import type { CommandContext } from '@game-judge/game-engine/platform/engine';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { handleStoryRelayEffect } from '../effects';
import { storyRelayWorkerModule } from '../module';
import { storyRelayEffectSchema } from '../schemas';

const HOST = 'storyrelay-host';

/** An armed answering phase: round started, deadline at 1000 + 90s. */
function armedAnsweringState(): StoryRelayState {
  const created = storyRelayWorkerModule.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
    roomCode: '1234',
    hostUserId: HOST,
    nowMs: 1000,
    commandId: 'create',
  });
  if (created.kind !== 'created') throw new Error(created.reason);
  let state = created.state;
  let commandNumber = 0;
  const send = (command: StoryRelayCommand, controlledSeat: number | null = null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId: HOST },
      controlledSeat,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: 'round',
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind !== 'commit') throw new Error(`rejected: ${decision.reason}`);
    state = STORY_RELAY_STATE_CODEC.parse(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'storyrelay.game.begin' });
  return state;
}

function settleEffectFor(
  state: StoryRelayState,
  overrides: Partial<Extract<StoryRelayEffect, { type: 'storyrelay.settle.due' }>['payload']> = {},
): StoryRelayEffect {
  return storyRelayEffectSchema.parse({
    type: 'storyrelay.settle.due',
    payload: {
      roundId: state.roundId,
      phaseRevision: state.phaseRevision,
      stepIndex: state.stepIndex,
      deadlineAt: state.deadlineAt,
      ...overrides,
    },
  });
}

/**
 * Effect context whose dispatchInternal runs the real engine internal
 * decide, so a settle delivery settles (or rejects) for real.
 */
function settleContext(state: StoryRelayState, nowMs = 91_000) {
  const box: { current: StoryRelayState; commands: StoryRelayInternalCommand[] } = {
    current: state,
    commands: [],
  };
  const context: WorkerEffectContext<StoryRelayState, StoryRelayInternalCommand> = {
    bindings: env,
    effectId: 'settle-effect',
    state,
    roomIdentity: {
      roomId: 'storyrelay-room',
      roomCode: '1234',
      creationId: 'storyrelay-creation',
    },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: (commandId, command) => {
      box.commands.push(command);
      const decision = storyRelayWorkerModule.decideInternal(box.current, command, {
        actor: { kind: 'system', effectId: 'settle-effect' },
        controlledSeat: null,
        nowMs,
        commandId,
        randomSeed: commandId,
      });
      if (decision.kind === 'reject') {
        return Promise.resolve({ kind: 'rejected', commandId, reason: decision.reason });
      }
      box.current = decision.state;
      return Promise.resolve(
        createRoomCommandResult({
          kind: 'committed',
          commandId,
          state: decision.state,
          revision: 11,
          outcome: { kind: 'success' },
        }),
      );
    },
  };
  return { context, box };
}

describe('Story Relay settle effect', () => {
  it('validates the settle payload strictly', () => {
    const state = armedAnsweringState();
    const effect = settleEffectFor(state);
    expect(effect.type).toBe('storyrelay.settle.due');
    expect(
      storyRelayEffectSchema.safeParse({
        type: 'storyrelay.settle.due',
        payload: { ...settledPayload(effect), extra: true },
      }).success,
    ).toBe(false);
    expect(
      storyRelayEffectSchema.safeParse({
        type: 'storyrelay.settle.due',
        payload: { roundId: state.roundId, phaseRevision: 1, stepIndex: 0 },
      }).success,
    ).toBe(false);
    expect(
      storyRelayEffectSchema.safeParse({ type: 'storyrelay.unknown', payload: {} }).success,
    ).toBe(false);
  });

  it('keys settle effects by arming identity and delivers them at the deadline', () => {
    const state = armedAnsweringState();
    const effect = settleEffectFor(state);
    const businessContext = { originCommandId: 'begin-1', createdRevision: 10 };
    expect(storyRelayWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      `storyrelay:settle:${state.deadlineAt}:${state.roundId}:${state.phaseRevision}:${state.stepIndex}`,
    );
    expect(storyRelayWorkerModule.getEffectDeliveryAt?.(effect, businessContext)).toBe(
      state.deadlineAt,
    );
    expect(
      storyRelayWorkerModule.getEffectBusinessKey(
        settleEffectFor(state, { phaseRevision: state.phaseRevision + 1 }),
        businessContext,
      ),
    ).not.toBe(storyRelayWorkerModule.getEffectBusinessKey(effect, businessContext));
  });

  it('dispatches the internal settle command when the arming is current', async () => {
    const state = armedAnsweringState();
    const { context, box } = settleContext(state);
    await handleStoryRelayEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'storyrelay.phase.settleExpired' }]);
    expect(box.current.phase).toBe('settling');
    expect(box.current.deadlineAt).toBeNull();
  });

  it('no-ops a stale delivery without dispatching', async () => {
    const state = armedAnsweringState();
    const { context, box } = settleContext(state);
    await handleStoryRelayEffect(
      settleEffectFor(state, { phaseRevision: state.phaseRevision + 1 }),
      context,
    );
    expect(box.commands).toEqual([]);
    expect(box.current).toBe(state);
  });

  it('treats a superseded rejection as done, and fails fast on an actor rejection', async () => {
    const state = armedAnsweringState();
    const superseded = settleContext(state, 1000);
    const supersededContext: WorkerEffectContext<StoryRelayState, StoryRelayInternalCommand> = {
      ...superseded.context,
      dispatchInternal: (commandId) =>
        Promise.resolve({ kind: 'rejected', commandId, reason: STORY_RELAY_REASONS.phase }),
    };
    await expect(
      handleStoryRelayEffect(settleEffectFor(state), supersededContext),
    ).resolves.toBeUndefined();

    const actorRejected = settleContext(state, 91_000);
    const actorContext: WorkerEffectContext<StoryRelayState, StoryRelayInternalCommand> = {
      ...actorRejected.context,
      dispatchInternal: (commandId) =>
        Promise.resolve({
          kind: 'rejected',
          commandId,
          reason: 'controlled_seat_not_allowed',
        }),
    };
    await expect(handleStoryRelayEffect(settleEffectFor(state), actorContext)).rejects.toThrow();
  });
});

function settledPayload(
  effect: StoryRelayEffect,
): Extract<StoryRelayEffect, { type: 'storyrelay.settle.due' }>['payload'] {
  if (effect.type !== 'storyrelay.settle.due') throw new Error('Expected a settle effect');
  return effect.payload;
}

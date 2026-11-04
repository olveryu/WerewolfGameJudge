/** Story Relay Worker boundary tests for ordinary commands and canonical room registration. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  STORY_RELAY_STATE_CODEC,
} from '@game-judge/game-engine/games/storyrelay/public';
import { describe, expect, it } from 'vitest';

import { WORKER_GAME_CATALOG } from '../../catalog';
import {
  storyRelayCreateConfigSchema,
  storyRelayEffectSchema,
  storyRelayInternalCommandSchema,
  storyRelayPublicCommandSchema,
} from '../schemas';

describe('Story Relay Worker', () => {
  it('rejects the removed host finish command', () => {
    expect(
      storyRelayPublicCommandSchema.safeParse({
        type: 'storyrelay.phase.finish',
        phaseRevision: 1,
      }).success,
    ).toBe(false);
  });

  it('creates a room with the registered codec and strict ordinary settings', () => {
    const result = WORKER_GAME_CATALOG.storyrelay.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
      roomCode: '1234',
      hostUserId: 'host',
      nowMs: 1,
      commandId: 'create',
    });
    if (result.kind !== 'created') throw new Error(result.reason);
    expect(STORY_RELAY_STATE_CODEC.parse(result.state)).toMatchObject({
      phase: 'lobby',
      config: DEFAULT_STORY_RELAY_CONFIG,
    });
    expect(
      storyRelayCreateConfigSchema.safeParse({ ...DEFAULT_STORY_RELAY_CONFIG, extra: true })
        .success,
    ).toBe(false);
  });
  it('requires task identity and rejects overlong manuscripts without truncation', () => {
    const task = {
      type: 'storyrelay.text.submit',
      roundId: 'round',
      stepIndex: 0,
      chainId: 'chain',
      text: '  开头\n正文  ',
    };
    expect(storyRelayPublicCommandSchema.parse(task)).toEqual(task);
    expect(
      storyRelayPublicCommandSchema.safeParse({ type: task.type, text: task.text }).success,
    ).toBe(false);
    expect(
      storyRelayPublicCommandSchema.safeParse({ ...task, text: '文'.repeat(513) }).success,
    ).toBe(false);
    expect(storyRelayPublicCommandSchema.safeParse({ ...task, text: '\n  ' }).success).toBe(false);
    expect(
      storyRelayPublicCommandSchema.safeParse({ ...task, userId: 'impersonation' }).success,
    ).toBe(false);
  });

  it('accepts only the internal settle command on the internal schema', () => {
    expect(
      storyRelayInternalCommandSchema.parse({ type: 'storyrelay.phase.settleExpired' }),
    ).toEqual({ type: 'storyrelay.phase.settleExpired' });
    expect(
      storyRelayInternalCommandSchema.safeParse({
        type: 'storyrelay.phase.expire',
        phaseRevision: 1,
      }).success,
    ).toBe(false);
    expect(
      storyRelayInternalCommandSchema.safeParse({
        type: 'storyrelay.phase.settleExpired',
        phaseRevision: 1,
      }).success,
    ).toBe(false);
    expect(
      storyRelayPublicCommandSchema.safeParse({ type: 'storyrelay.phase.settleExpired' }).success,
    ).toBe(false);
  });

  it('validates the settle effect strictly', () => {
    const payload = {
      roundId: 'storyrelay-round:command-1',
      phaseRevision: 1,
      stepIndex: 0,
      deadlineAt: 45000,
    };
    expect(storyRelayEffectSchema.parse({ type: 'storyrelay.settle.due', payload })).toEqual({
      type: 'storyrelay.settle.due',
      payload,
    });
    expect(
      storyRelayEffectSchema.safeParse({
        type: 'storyrelay.settle.due',
        payload: { ...payload, extra: true },
      }).success,
    ).toBe(false);
    expect(
      storyRelayEffectSchema.safeParse({
        type: 'storyrelay.settle.due',
        payload: { roundId: payload.roundId, phaseRevision: 1, stepIndex: 0 },
      }).success,
    ).toBe(false);
  });
});

/** Story Relay Worker boundary tests for ordinary commands and canonical room registration. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  STORY_RELAY_STATE_CODEC,
} from '@game-judge/game-engine/games/storyrelay/public';
import { describe, expect, it } from 'vitest';

import { WORKER_GAME_CATALOG } from '../../catalog';
import { storyRelayCreateConfigSchema, storyRelayPublicCommandSchema } from '../schemas';

describe('Story Relay Worker', () => {
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
});

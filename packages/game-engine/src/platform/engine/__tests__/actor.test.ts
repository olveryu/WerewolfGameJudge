import { describe, expect, it } from 'vitest';

import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';
import { requireHost } from '../actor';
import type { CommandContext } from '../types';

const user = (userId: string, controlledSeat: number | null = null): CommandContext => ({
  actor: { kind: 'user', userId },
  controlledSeat,
  nowMs: 1000,
  commandId: 'actor-test',
  randomSeed: 'actor-test',
});

const system = (): CommandContext => ({
  actor: { kind: 'system', effectId: 'effect-1' },
  controlledSeat: null,
  nowMs: 1000,
  commandId: 'actor-test',
  randomSeed: 'actor-test',
});

describe('requireHost', () => {
  it('admits the host acting uncontrolled', () => {
    expect(requireHost(user('host'), 'host')).toBeNull();
  });

  it('rejects a non-host with the platform code by default', () => {
    expect(requireHost(user('guest'), 'host')).toEqual({
      kind: 'reject',
      reason: REASON_NOT_HOST,
    });
  });

  it('re-labels only the not-host outcome with a game-supplied reason', () => {
    expect(requireHost(user('guest'), 'host', 'game_not_host_start')).toEqual({
      kind: 'reject',
      reason: 'game_not_host_start',
    });
  });

  it('passes the controlled-seat outcome through, never re-labelled', () => {
    expect(requireHost(user('host', 2), 'host', 'game_not_host_start')).toEqual({
      kind: 'reject',
      reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    });
  });

  it('passes the user-required outcome through for a system actor', () => {
    expect(requireHost(system(), 'host', 'game_not_host_start')).toEqual({
      kind: 'reject',
      reason: REASON_USER_ACTOR_REQUIRED,
    });
  });
});

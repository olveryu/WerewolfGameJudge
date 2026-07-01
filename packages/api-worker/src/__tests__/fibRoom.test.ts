/**
 * fibking generic-engine DO path — integration tests.
 *
 * Exercises GameRoom.initState + dispatch through the real Durable Object (Workers runtime),
 * proving the engine registry wiring end-to-end and that werewolf bespoke methods are untouched.
 */

import { fibEngine } from '@werewolf/game-engine/fibking/engine';
import { FIB_DEFAULT_PLAYERS, type FibState } from '@werewolf/game-engine/fibking/types';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { GameRoom } from '../durableObjects/GameRoom';
import type { DispatchResult } from '../durableObjects/processEngineAction';

function getStub(): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM!.newUniqueId();
  return env.GAME_ROOM!.get(id);
}

async function initFib(
  stub: DurableObjectStub<GameRoom>,
  numberOfPlayers = FIB_DEFAULT_PLAYERS,
): Promise<void> {
  const blob = fibEngine.createInitialState(
    { numberOfPlayers },
    { roomCode: 'TEST', hostUserId: 'host' },
  );
  await stub.initState('fibking', blob);
}

function dispatch(
  stub: DurableObjectStub<GameRoom>,
  actionType: string,
  payload: unknown,
): Promise<DispatchResult> {
  return stub.engineAction(actionType, payload);
}

async function getFibState(stub: DurableObjectStub<GameRoom>): Promise<FibState> {
  const snap = (await stub.getState()) as { state: FibState; revision: number } | null;
  if (!snap) throw new Error('no state');
  return snap.state;
}

async function sitAll(stub: DurableObjectStub<GameRoom>, count: number): Promise<void> {
  for (let seat = 0; seat < count; seat++) {
    const r = await dispatch(stub, 'SIT', {
      userId: `u${seat}`,
      seat,
      profile: { displayName: `P${seat}` },
    });
    expect(r.success).toBe(true);
  }
}

describe('GameRoom generic engine path (fibking)', () => {
  it('dispatch before initState fails fast', async () => {
    const stub = getStub();
    const r = await runInDurableObject(stub, async (instance) =>
      instance.engineAction('SIT', { userId: 'u', seat: 0, profile: { displayName: 'A' } }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.reason).toBe('ENGINE_NOT_INITIALIZED');
  });

  it('initState + SIT persists and broadcasts new state', async () => {
    const stub = getStub();
    await initFib(stub);
    const r = await dispatch(stub, 'SIT', {
      userId: 'u0',
      seat: 0,
      profile: { displayName: 'Alice' },
    });
    expect(r.success).toBe(true);
    const state = await getFibState(stub);
    expect(state.seats[0]).toEqual({ userId: 'u0', seat: 0 });
    expect(state.roster.u0).toEqual({ displayName: 'Alice' });
  });

  it('unknown action fails fast', async () => {
    const stub = getStub();
    await initFib(stub);
    const r = await dispatch(stub, 'NOPE', {});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.reason).toBe('UNKNOWN_ACTION:NOPE');
  });

  it('full round: sit → begin → start → reveal', async () => {
    const stub = getStub();
    await initFib(stub, 4);
    await sitAll(stub, 4);

    // not full guard already satisfied (4/4)
    const begin = await dispatch(stub, 'BEGIN_DRAW', {});
    expect(begin.success).toBe(true);
    expect((await getFibState(stub)).phase).toBe('Starting');

    const start = await dispatch(stub, 'START_ROUND', {
      word: '踟蹰',
      definition: '徘徊不前',
      source: 'fallback',
    });
    expect(start.success).toBe(true);

    const playing = await getFibState(stub);
    expect(playing.phase).toBe('Playing');
    expect(playing.word).toBe('踟蹰');
    expect(Object.keys(playing.roleBySeat ?? {})).toHaveLength(4);
    expect(playing.usedWords).toEqual(['踟蹰']);

    const reveal = await dispatch(stub, 'REVEAL', {});
    expect(reveal.success).toBe(true);
    expect((await getFibState(stub)).phase).toBe('Revealed');
  });

  it('BEGIN_DRAW fails fast when not full', async () => {
    const stub = getStub();
    await initFib(stub, 4);
    await sitAll(stub, 3);
    const begin = await dispatch(stub, 'BEGIN_DRAW', {});
    expect(begin.success).toBe(false);
    if (!begin.success) expect(begin.reason).toBe('NOT_FULL');
  });
});

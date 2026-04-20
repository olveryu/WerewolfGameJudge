/**
 * GameRoom Durable Object — integration tests
 *
 * 通过 RPC stub 测试 DO 的完整生命周期。
 * 运行在 Workers 运行时内（@cloudflare/vitest-pool-workers）。
 */

import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { GameActionResult } from '../durableObjects/gameProcessor';
import type { GameRoom } from '../durableObjects/GameRoom';

function createTemplate(roles: string[]) {
  return { name: 'Test', numberOfPlayers: roles.length, roles };
}

function getStub(): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM.newUniqueId();
  return env.GAME_ROOM.get(id);
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

describe('GameRoom lifecycle', () => {
  it('getState returns null before init', async () => {
    const stub = getStub();
    const result = await stub.getState();
    expect(result).toBeNull();
  });

  it('getRevision returns null before init', async () => {
    const stub = getStub();
    const revision = await stub.getRevision();
    expect(revision).toBeNull();
  });

  it('init + getState round-trip preserves state', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    const initialState = buildInitialGameState('ROOM1', 'host-uid', template);

    await stub.init(initialState);

    const result = await stub.getState();
    expect(result).not.toBeNull();
    expect(result!.state.roomCode).toBe('ROOM1');
    expect(result!.state.hostUid).toBe('host-uid');
    expect(result!.state.status).toBe(GameStatus.Unseated);
    expect(result!.revision).toBe(1);
  });

  it('getRevision returns 1 after init', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('R2', 'host', template));

    const revision = await stub.getRevision();
    expect(revision).toBe(1);
  });

  it('cleanup completes without error', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('R3', 'host', template));

    // cleanup() calls deleteAll() which wipes SQLite.
    // In production the DO instance is evicted after this; no further RPC calls.
    await expect(stub.cleanup()).resolves.toBeUndefined();
  });
});

// ── Seat management ─────────────────────────────────────────────────────────

describe('GameRoom seat management', () => {
  async function initRoom(): Promise<DurableObjectStub<GameRoom>> {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('SEAT-ROOM', 'host-uid', template));
    return stub;
  }

  it('sit places player in seat', async () => {
    const stub = await initRoom();

    const result = (await stub.seat('sit', 'p1', 0, 'Player1')) as GameActionResult;

    expect(result.success).toBe(true);
    expect(result.state?.players[0]).toBeTruthy();
    expect(result.state!.players[0]!.uid).toBe('p1');
    expect(result.state!.roster['p1'].displayName).toBe('Player1');
    expect(result.revision).toBe(2);
  });

  it('standup removes player from seat', async () => {
    const stub = await initRoom();
    await stub.seat('sit', 'p1', 0, 'Player1');

    const result = (await stub.seat('standup', 'p1', null)) as GameActionResult;

    expect(result.success).toBe(true);
    expect(result.state?.players[0]).toBeNull();
  });

  it('kick removes target player', async () => {
    const stub = await initRoom();
    // Host sits at seat 0
    await stub.seat('sit', 'host-uid', 0, 'Host');
    // Player sits at seat 1
    await stub.seat('sit', 'p1', 1, 'Player1');

    const result = (await stub.seat(
      'kick',
      'host-uid',
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
    )) as GameActionResult;

    expect(result.success).toBe(true);
    expect(result.state?.players[1]).toBeNull();
  });
});

// ── Game flow ───────────────────────────────────────────────────────────────

describe('GameRoom game flow', () => {
  async function initSeatedRoom(): Promise<DurableObjectStub<GameRoom>> {
    const stub = getStub();
    const roles = ['villager', 'wolf', 'seer'];
    const template = createTemplate(roles);
    await stub.init(buildInitialGameState('FLOW-ROOM', 'host-uid', template));

    // Seat all players (host + 2 others)
    await stub.seat('sit', 'host-uid', 0, 'Host');
    await stub.seat('sit', 'p1', 1, 'P1');
    await stub.seat('sit', 'p2', 2, 'P2');

    return stub;
  }

  it('assignRoles transitions to Assigned status', async () => {
    const stub = await initSeatedRoom();

    const result = (await stub.assignRoles()) as GameActionResult;

    expect(result.success).toBe(true);
    expect(result.state?.status).toBe(GameStatus.Assigned);
    // All players should have roles assigned
    for (let i = 0; i < 3; i++) {
      expect(result.state!.players[i]!.role).toBeTruthy();
    }
  });

  it('fillWithBots fills empty seats', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('BOT-ROOM', 'host-uid', template));
    // Only seat the host
    await stub.seat('sit', 'host-uid', 0, 'Host');

    const result = (await stub.fillWithBots()) as GameActionResult;

    expect(result.success).toBe(true);
    // Remaining seats should be bots
    expect(result.state!.players[1]?.isBot).toBe(true);
    expect(result.state!.players[2]?.isBot).toBe(true);
  });

  it('restartGame resets to Seated (players keep seats)', async () => {
    const stub = await initSeatedRoom();
    await stub.assignRoles();

    const result = (await stub.restartGame()) as GameActionResult;

    expect(result.success).toBe(true);
    // Players are still seated → status is Seated, not Unseated
    expect(result.state?.status).toBe(GameStatus.Seated);
  });

  it('updateTemplate changes template roles', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('TPL-ROOM', 'host-uid', template));

    const result = (await stub.updateTemplate(['villager', 'wolf', 'witch'])) as GameActionResult;

    expect(result.success).toBe(true);
    expect(result.state?.templateRoles).toEqual(['villager', 'wolf', 'witch']);
  });

  it('revision increments with each state change', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('REV-ROOM', 'host-uid', template));
    expect(await stub.getRevision()).toBe(1);

    await stub.seat('sit', 'host-uid', 0, 'Host');
    expect(await stub.getRevision()).toBe(2);

    await stub.seat('sit', 'p1', 1, 'P1');
    expect(await stub.getRevision()).toBe(3);
  });
});

// ── Error cases ─────────────────────────────────────────────────────────────

describe('GameRoom error handling', () => {
  it('RPC method returns error before init', async () => {
    const stub = getStub();

    const result = (await stub.assignRoles()) as GameActionResult;

    expect(result.success).toBe(false);
    expect(result.reason).toBe('ROOM_NOT_FOUND');
  });

  it('startNight fails when not all roles viewed', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('ERR-ROOM', 'host-uid', template));
    await stub.seat('sit', 'host-uid', 0, 'Host');
    await stub.seat('sit', 'p1', 1, 'P1');
    await stub.seat('sit', 'p2', 2, 'P2');
    await stub.assignRoles();
    // Don't view roles → startNight should fail

    const result = (await stub.startNight()) as GameActionResult;

    expect(result.success).toBe(false);
  });
});

// Note: WebSocket upgrade tests omitted — stub.fetch() with Hibernation API
// creates WAL files that break vitest-pool-workers isolated storage.
// WebSocket behavior is verified via E2E tests instead.

// ── Internal state verification ─────────────────────────────────────────────

describe('GameRoom internal SQLite', () => {
  it('SQLite table is properly initialized', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.init(buildInitialGameState('SQL-ROOM', 'host-uid', template));

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const rows = state.storage.sql
        .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
        .toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0].revision).toBe(1);

      const parsedState = JSON.parse(rows[0].game_state as string) as GameState;
      expect(parsedState.roomCode).toBe('SQL-ROOM');
    });
  });
});

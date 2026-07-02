/**
 * GameRoom Durable Object -- integration tests
 *
 * Tests the full DO lifecycle through the RPC stub.
 * Runs inside the Workers runtime (@cloudflare/vitest-pool-workers).
 */

import { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import { WEREWOLF_ACTION } from '@werewolf/game-engine/werewolf/actions';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles/spec/specs';
import type { GameTemplate } from '@werewolf/game-engine/werewolf/models/Template';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';
import { buildInitialWerewolfStateFromTemplate } from '@werewolf/game-engine/werewolf/state/buildInitialWerewolfState';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { GameRoom } from '../durableObjects/GameRoom';
import type { DispatchResult } from '../durableObjects/processEngineAction';

function createTemplate(roles: RoleId[]): GameTemplate {
  return { name: 'Test', numberOfPlayers: roles.length, roles };
}

function getStub(): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM!.newUniqueId();
  return env.GAME_ROOM!.get(id);
}

/** Test helper for werewolf room snapshots. */
function assertGameStateSnapshot(
  result: { state: unknown; revision: number } | null,
): asserts result is { state: WerewolfState; revision: number } {
  if (!result) throw new Error('Expected WerewolfState snapshot');
  if (!isGameState(result.state)) throw new Error('Expected snapshot state to be WerewolfState');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGameState(value: unknown): value is WerewolfState {
  if (!isRecord(value)) return false;
  return (
    typeof value.roomCode === 'string' &&
    typeof value.hostUserId === 'string' &&
    isRecord(value.players) &&
    isRecord(value.roster) &&
    Array.isArray(value.templateRoles)
  );
}

/** Narrows a DispatchResult to the success branch; throws if failed. */
function assertSuccess(result: DispatchResult): asserts result is Extract<
  DispatchResult,
  { success: true }
> & {
  state: WerewolfState;
  revision: number;
} {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${result.reason}`);
  }
  if (!isGameState(result.state)) {
    throw new Error('Expected success result to include WerewolfState');
  }
  if (typeof result.revision !== 'number') {
    throw new Error('Expected success result to include revision');
  }
}

function action(
  stub: DurableObjectStub<GameRoom>,
  actionType: string,
  payload: unknown = {},
): Promise<DispatchResult> {
  return stub.engineAction(actionType, payload);
}

/** Shorthand: sit a player with displayName only (most common case). */
function sit(
  stub: DurableObjectStub<GameRoom>,
  userId: string,
  seat: number,
  displayName: string,
  extra?: Record<string, unknown>,
): Promise<DispatchResult> {
  return action(stub, WEREWOLF_ACTION.SEAT, {
    action: 'sit',
    userId,
    seat,
    displayName,
    ...extra,
  });
}

/** Shorthand: standup. */
function standup(stub: DurableObjectStub<GameRoom>, userId: string): Promise<DispatchResult> {
  return action(stub, WEREWOLF_ACTION.SEAT, { action: 'standup', userId });
}

/** Shorthand: kick. */
function kick(
  stub: DurableObjectStub<GameRoom>,
  hostUserId: string,
  targetSeat: number,
): Promise<DispatchResult> {
  return action(stub, WEREWOLF_ACTION.SEAT, {
    action: 'kick',
    userId: hostUserId,
    targetSeat,
  });
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
    const initialState = buildInitialWerewolfStateFromTemplate('ROOM1', 'host-uid', template);

    await stub.initState(WEREWOLF_GAME_TYPE, initialState);

    const result = await stub.getState();
    assertGameStateSnapshot(result);
    expect(result.state).toMatchObject({
      roomCode: 'ROOM1',
      hostUserId: 'host-uid',
      status: GameStatus.Unseated,
    });
    expect(result.revision).toBe(1);
  });

  it('getRevision returns 1 after init', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('R2', 'host', template),
    );

    const revision = await stub.getRevision();
    expect(revision).toBe(1);
  });

  it('cleanup completes without error', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('R3', 'host', template),
    );

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
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('SEAT-ROOM', 'host-uid', template),
    );
    return stub;
  }

  it('sit places player in seat', async () => {
    const stub = await initRoom();

    const result = await sit(stub, 'p1', 0, 'Player1');

    assertSuccess(result);
    expect(result.state?.players[0]).toBeTruthy();
    expect(result.state.players[0]!.userId).toBe('p1');
    expect(result.state.roster['p1'].displayName).toBe('Player1');
    expect(result.revision).toBe(2);
  });

  it('standup removes player from seat', async () => {
    const stub = await initRoom();
    await sit(stub, 'p1', 0, 'Player1');

    const result = await standup(stub, 'p1');

    assertSuccess(result);
    expect(result.state?.players[0]).toBeNull();
  });

  it('kick removes target player', async () => {
    const stub = await initRoom();
    // Host sits at seat 0
    await sit(stub, 'host-uid', 0, 'Host');
    // Player sits at seat 1
    await sit(stub, 'p1', 1, 'Player1');

    const result = await kick(stub, 'host-uid', 1);

    assertSuccess(result);
    expect(result.state?.players[1]).toBeNull();
  });
});

// ── Game flow ───────────────────────────────────────────────────────────────

describe('GameRoom game flow', () => {
  async function initSeatedRoom(): Promise<DurableObjectStub<GameRoom>> {
    const stub = getStub();
    const roles: RoleId[] = ['villager', 'wolf', 'seer'];
    const template = createTemplate(roles);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('FLOW-ROOM', 'host-uid', template),
    );

    // Seat all players (host + 2 others)
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');

    return stub;
  }

  it('assignRoles transitions to Assigned status', async () => {
    const stub = await initSeatedRoom();

    const result = await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    assertSuccess(result);
    expect(result.state?.status).toBe(GameStatus.Assigned);
    // All players should have roles assigned
    for (let i = 0; i < 3; i++) {
      expect(result.state.players[i]!.role).toBeTruthy();
    }
  });

  it('fillWithBots fills empty seats', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('BOT-ROOM', 'host-uid', template),
    );
    // Only seat the host
    await sit(stub, 'host-uid', 0, 'Host');

    const result = await action(stub, WEREWOLF_ACTION.FILL_WITH_BOTS);

    assertSuccess(result);
    // Remaining seats should be bots
    expect(result.state.players[1]?.isBot).toBe(true);
    expect(result.state.players[2]?.isBot).toBe(true);
  });

  it('restartGame resets to Seated (players keep seats)', async () => {
    const stub = await initSeatedRoom();
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    const result = await action(stub, WEREWOLF_ACTION.RESTART_GAME);

    assertSuccess(result);
    // Players are still seated -> status is Seated, not Unseated
    expect(result.state?.status).toBe(GameStatus.Seated);
  });

  it('updateTemplate changes template roles', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('TPL-ROOM', 'host-uid', template),
    );

    const result = await action(stub, WEREWOLF_ACTION.UPDATE_TEMPLATE, {
      templateRoles: ['villager', 'wolf', 'witch'],
    });

    assertSuccess(result);
    expect(result.state?.templateRoles).toEqual(['villager', 'wolf', 'witch']);
  });

  it('revision increments with each state change', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('REV-ROOM', 'host-uid', template),
    );
    expect(await stub.getRevision()).toBe(1);

    await sit(stub, 'host-uid', 0, 'Host');
    expect(await stub.getRevision()).toBe(2);

    await sit(stub, 'p1', 1, 'P1');
    expect(await stub.getRevision()).toBe(3);
  });
});

// ── Error cases ─────────────────────────────────────────────────────────────

describe('GameRoom error handling', () => {
  it('RPC method returns error before init', async () => {
    const stub = getStub();

    const result = await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('GAME_NOT_INITIALIZED');
  });

  it('startNight fails when not all roles viewed', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('ERR-ROOM', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);
    // Don't view roles -> startNight should fail

    const result = await action(stub, WEREWOLF_ACTION.START_NIGHT);

    expect(result.success).toBe(false);
  });
});

// Note: WebSocket upgrade tests omitted -- stub.fetch() with Hibernation API
// creates WAL files that break vitest-pool-workers isolated storage.
// WebSocket behavior is verified via E2E tests instead.

// ── Internal state verification ─────────────────────────────────────────────

describe('GameRoom internal SQLite', () => {
  it('SQLite table is properly initialized', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('SQL-ROOM', 'host-uid', template),
    );

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const rows = state.storage.sql
        .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
        .toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0].revision).toBe(1);

      const gameStateJson = rows[0].game_state;
      if (typeof gameStateJson !== 'string') {
        throw new Error('Expected game_state JSON string');
      }
      const parsedState: unknown = JSON.parse(gameStateJson);
      if (!isGameState(parsedState)) {
        throw new Error('Expected parsed WerewolfState');
      }
      expect(parsedState.roomCode).toBe('SQL-ROOM');
    });
  });
});

// ── Night flow (happy path) ─────────────────────────────────────────────────

describe('GameRoom night flow', () => {
  /** Create a 3-player room, assign roles, have all view, reach Ready status. */
  async function initReadyRoom(): Promise<DurableObjectStub<GameRoom>> {
    const stub = getStub();
    const roles: RoleId[] = ['villager', 'wolf', 'seer'];
    const template = createTemplate(roles);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('NIGHT-ROOM', 'host-uid', template),
    );

    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    // Host views all roles (host can mark any seat)
    await action(stub, WEREWOLF_ACTION.VIEW_ROLE, { userId: 'host-uid', seat: 0 });
    await action(stub, WEREWOLF_ACTION.VIEW_ROLE, { userId: 'host-uid', seat: 1 });
    await action(stub, WEREWOLF_ACTION.VIEW_ROLE, { userId: 'host-uid', seat: 2 });

    return stub;
  }

  it('viewRole transitions all-viewed to Ready', async () => {
    const stub = await initReadyRoom();
    const result = await stub.getState();
    assertGameStateSnapshot(result);

    expect(result.state).toMatchObject({ status: GameStatus.Ready });
  });

  it('startNight transitions to Ongoing after all roles viewed', async () => {
    const stub = await initReadyRoom();

    const result = await action(stub, WEREWOLF_ACTION.START_NIGHT);

    assertSuccess(result);
    expect(result.state?.status).toBe(GameStatus.Ongoing);
    expect(result.state?.currentStepId).toBeDefined();
  });

  it('viewRole non-host cannot view another seat', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('VR-ERR', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    // p1 tries to view seat 2 (not their seat)
    const result = await action(stub, WEREWOLF_ACTION.VIEW_ROLE, { userId: 'p1', seat: 2 });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_my_seat');
  });

  it('viewRole succeeds for own seat', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('VR-OK', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    const result = await action(stub, WEREWOLF_ACTION.VIEW_ROLE, { userId: 'p1', seat: 1 });

    assertSuccess(result);
    expect(result.state?.players[1]?.hasViewedRole).toBe(true);
  });
});

// ── clearAllSeats ───────────────────────────────────────────────────────────

describe('GameRoom clearAllSeats', () => {
  it('clears all players from seats', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('CLEAR-ROOM', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');

    const result = await action(stub, WEREWOLF_ACTION.CLEAR_ALL_SEATS);

    assertSuccess(result);
    // All seats should be null
    for (let i = 0; i < 3; i++) {
      expect(result.state.players[i]).toBeNull();
    }
    expect(result.state.status).toBe(GameStatus.Unseated);
  });

  it('clearAllSeats fails during game', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('CLEAR-ERR', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await sit(stub, 'p1', 1, 'P1');
    await sit(stub, 'p2', 2, 'P2');
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    const result = await action(stub, WEREWOLF_ACTION.CLEAR_ALL_SEATS);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_in_progress');
  });
});

// ── Board nomination ────────────────────────────────────────────────────────

describe('GameRoom board nomination', () => {
  async function initUnseatRoom(): Promise<DurableObjectStub<GameRoom>> {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('NOM-ROOM', 'host-uid', template),
    );
    return stub;
  }

  it('boardNominate adds a nomination', async () => {
    const stub = await initUnseatRoom();

    const result = await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p1',
      displayName: 'Player1',
      roles: ['wolf', 'seer', 'villager', 'witch'],
    });

    assertSuccess(result);
    expect(result.state?.boardNominations).toBeTruthy();
    expect(result.state.boardNominations!['p1']).toBeTruthy();
  });

  it('boardUpvote votes for existing nomination', async () => {
    const stub = await initUnseatRoom();
    await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p1',
      displayName: 'Player1',
      roles: ['wolf', 'seer', 'villager', 'witch'],
    });

    const result = await action(stub, WEREWOLF_ACTION.BOARD_UPVOTE, {
      voterUid: 'p2',
      targetUserId: 'p1',
    });

    assertSuccess(result);
    const nomination = result.state.boardNominations!['p1'];
    expect(nomination.upvoters).toContain('p2');
  });

  it('boardWithdraw removes own nomination', async () => {
    const stub = await initUnseatRoom();
    await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p1',
      displayName: 'Player1',
      roles: ['wolf', 'seer', 'villager', 'witch'],
    });

    const result = await action(stub, WEREWOLF_ACTION.BOARD_WITHDRAW, { userId: 'p1' });

    assertSuccess(result);
    // After withdraw, the nomination should be removed
    const noms = result.state.boardNominations ?? {};
    expect(noms['p1']).toBeUndefined();
  });

  it('boardUpvote fails for nonexistent nomination', async () => {
    const stub = await initUnseatRoom();

    const result = await action(stub, WEREWOLF_ACTION.BOARD_UPVOTE, {
      voterUid: 'p2',
      targetUserId: 'nobody',
    });

    expect(result.success).toBe(false);
  });

  it('boardNominate deduplicates identical role sets', async () => {
    const stub = await initUnseatRoom();
    // p1 nominates [wolf, seer, villager]
    await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p1',
      displayName: 'Player1',
      roles: ['wolf', 'seer', 'villager'],
    });
    // p2 nominates same roles in different order -> should deduplicate
    const result = await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p2',
      displayName: 'Player2',
      roles: ['seer', 'villager', 'wolf'],
    });

    assertSuccess(result);
    // p2's nomination should be an upvote on p1's, not a separate entry
    const p1Nom = result.state.boardNominations!['p1'];
    expect(p1Nom.upvoters).toContain('p2');
  });

  it('boardNominate fails with empty roles', async () => {
    const stub = await initUnseatRoom();

    const result = await action(stub, WEREWOLF_ACTION.BOARD_NOMINATE, {
      userId: 'p1',
      displayName: 'Player1',
      roles: [],
    });

    expect(result.success).toBe(false);
  });
});

// ── markAllBotsViewed ───────────────────────────────────────────────────────

describe('GameRoom markAllBotsViewed', () => {
  it('marks bot roles as viewed', async () => {
    const stub = getStub();
    const template = createTemplate(['villager', 'wolf', 'seer']);
    await stub.initState(
      WEREWOLF_GAME_TYPE,
      buildInitialWerewolfStateFromTemplate('BOTV-ROOM', 'host-uid', template),
    );
    await sit(stub, 'host-uid', 0, 'Host');
    await action(stub, WEREWOLF_ACTION.FILL_WITH_BOTS);
    await action(stub, WEREWOLF_ACTION.ASSIGN_ROLES);

    const result = await action(stub, WEREWOLF_ACTION.MARK_ALL_BOTS_VIEWED);

    assertSuccess(result);
    // Bot seats (1, 2) should have viewed roles
    expect(result.state.players[1]?.hasViewedRole).toBe(true);
    expect(result.state.players[2]?.hasViewedRole).toBe(true);
  });
});

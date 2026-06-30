/**
 * handlers/roomHandlers — room CRUD Hono routes (Workers)
 *
 * /room/create, /room/get, /room/delete — D1 metadata operations.
 * /room/state, /room/revision — read game state from the DO.
 * create/delete require bidirectional sync with the DO.
 *
 * @throws 401 — requireAuth failed
 * @throws 400 — zod validation failed / room not found / room already exists
 * @throws 503/429 — callDO detected DO retryable/overloaded
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { rooms } from '../db/schema';
import { ENGINE_REGISTRY } from '../durableObjects/engineRegistry';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { CREATE_CONFIG_SCHEMAS } from '../schemas/engineCreate';
import { createRoomSchema, roomCodeBodySchema } from '../schemas/room';
import { getGameRoomStub, jsonBody } from './shared';

const log = createLogger('room');

/** Room management routes (create / join / state). */
export const roomRoutes = new Hono<AppEnv>();

// ── POST /room/create ───────────────────────────────────────────────────────
roomRoutes.post('/create', requireAuth, jsonBody(createRoomSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  // Engine path: build the authoritative initial state server-side from a validated config.
  let engineBlob: unknown;
  const gameType = parsed.gameType ?? 'werewolf';
  if (parsed.gameType) {
    const engine = ENGINE_REGISTRY[parsed.gameType];
    const cfgSchema = CREATE_CONFIG_SCHEMAS[parsed.gameType];
    if (!engine || !cfgSchema) {
      return c.json({ success: false, reason: 'UNKNOWN_GAME_TYPE' }, 400);
    }
    const cfg = cfgSchema.safeParse(parsed.config);
    if (!cfg.success) {
      return c.json({ success: false, reason: 'INVALID_CONFIG' }, 400);
    }
    engineBlob = engine.createInitialState(cfg.data, {
      roomCode: parsed.roomCode,
      hostUserId: userId,
    });
  }

  const now = sql`datetime('now')`;

  const inserted = await db
    .insert(rooms)
    .values({
      id: crypto.randomUUID(),
      code: parsed.roomCode,
      hostUserId: userId,
      gameType,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: rooms.code })
    .returning({ id: rooms.id });

  if (inserted.length === 0) {
    return c.json({ success: false, reason: 'ROOM_CODE_CONFLICT' }, 409);
  }

  // Initialize DO state. Engine path → initState(gameType, blob); werewolf legacy → init(blob).
  if (parsed.gameType || parsed.initialState) {
    try {
      const stub = getGameRoomStub(env, parsed.roomCode, c.req.raw);
      if (parsed.gameType) {
        await stub.initState(parsed.gameType, engineBlob);
      } else {
        await stub.init(parsed.initialState as GameState);
      }
    } catch (err) {
      // DO init failed → rollback D1 record
      log.error('DO init failed, rolling back', {
        roomCode: parsed.roomCode,
        gameType,
        error: err instanceof Error ? err.message : String(err),
      });
      await db.delete(rooms).where(eq(rooms.code, parsed.roomCode));
      throw err;
    }
  }

  return c.json(
    {
      room: {
        roomCode: parsed.roomCode,
        hostUserId: userId,
        gameType,
        createdAt: new Date().toISOString(),
      },
    },
    200,
  );
});

// ── POST /room/get ──────────────────────────────────────────────────────────
roomRoutes.post('/get', jsonBody(roomCodeBodySchema), async (c) => {
  const db = createDb(c.env.DB);
  const parsed = c.req.valid('json');

  const row = await db
    .select({
      code: rooms.code,
      hostUserId: rooms.hostUserId,
      gameType: rooms.gameType,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(eq(rooms.code, parsed.roomCode))
    .get();

  if (!row) {
    return c.json({ room: null }, 200);
  }

  return c.json(
    {
      room: {
        roomCode: row.code,
        hostUserId: row.hostUserId,
        gameType: row.gameType,
        createdAt: row.createdAt,
      },
    },
    200,
  );
});

// ── POST /room/delete ───────────────────────────────────────────────────────
roomRoutes.post('/delete', requireAuth, jsonBody(roomCodeBodySchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  // Only the room host can delete the room
  const result = await db
    .delete(rooms)
    .where(and(eq(rooms.code, parsed.roomCode), eq(rooms.hostUserId, userId)))
    .returning({ id: rooms.id });

  if (result.length === 0) {
    return c.json({ success: false, reason: 'ROOM_NOT_FOUND' }, 403);
  }

  // Clean up DO storage (non-critical path, failure does not block)
  try {
    const stub = getGameRoomStub(env, parsed.roomCode, c.req.raw);
    await stub.cleanup();
  } catch {
    // DO cleanup failure does not affect delete result.
    // Stale DO storage will be cleaned up by cron.
  }

  return c.json({ success: true }, 200);
});

// ── POST /room/state ────────────────────────────────────────────────────────
// Read full state + revision from the DO
roomRoutes.post('/state', jsonBody(roomCodeBodySchema), async (c) => {
  const parsed = c.req.valid('json');

  const stub = getGameRoomStub(c.env, parsed.roomCode, c.req.raw);
  const result = await stub.getState();

  if (!result) {
    return c.json({ state: null }, 200);
  }

  return c.json(
    {
      state: result.state,
      revision: result.revision,
    },
    200,
  );
});

// ── POST /room/revision ─────────────────────────────────────────────────────
// Lightweight: read revision number only (from the DO)
roomRoutes.post('/revision', jsonBody(roomCodeBodySchema), async (c) => {
  const parsed = c.req.valid('json');

  const stub = getGameRoomStub(c.env, parsed.roomCode, c.req.raw);
  const revision = await stub.getRevision();

  return c.json({ revision }, 200);
});

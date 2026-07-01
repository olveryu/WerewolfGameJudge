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

import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { rooms } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { createInitialRoomState } from '../roomCreate/registry';
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

  const gameType = parsed.gameType;
  const createdState = createInitialRoomState(gameType, parsed.config, {
    roomCode: parsed.roomCode,
    hostUserId: userId,
  });
  if (!createdState.success) {
    return c.json({ success: false, reason: createdState.reason }, 400);
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

  // Initialize DO state. Schema guarantees exactly one path; D1 rows never exist
  // without a matching Durable Object snapshot.
  try {
    const stub = getGameRoomStub(env, parsed.roomCode, c.req.raw);
    await stub.initState(gameType, createdState.state);
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
  const result: { state: unknown; revision: number } | null = await stub.getState();

  if (!result) {
    return c.json({ state: null }, 200);
  }

  return c.json(result, 200);
});

// ── POST /room/revision ─────────────────────────────────────────────────────
// Lightweight: read revision number only (from the DO)
roomRoutes.post('/revision', jsonBody(roomCodeBodySchema), async (c) => {
  const parsed = c.req.valid('json');

  const stub = getGameRoomStub(c.env, parsed.roomCode, c.req.raw);
  const revision = await stub.getRevision();

  return c.json({ revision }, 200);
});

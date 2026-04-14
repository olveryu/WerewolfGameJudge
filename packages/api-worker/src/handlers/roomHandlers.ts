/**
 * handlers/roomHandlers — 房间 CRUD Hono routes（Workers 版）
 *
 * /room/create、/room/get、/room/delete — D1 元数据操作。
 * /room/state、/room/revision — 从 DO 读取游戏状态。
 * create/delete 需要与 DO 双向同步。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { rooms } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createRoomSchema, roomCodeBodySchema } from '../schemas/room';
import { getGameRoomStub, jsonBody } from './shared';

export const roomRoutes = new Hono<AppEnv>();

// ── POST /room/create ───────────────────────────────────────────────────────
roomRoutes.post('/create', requireAuth, jsonBody(createRoomSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  const now = sql`datetime('now')`;

  try {
    await db.insert(rooms).values({
      id: crypto.randomUUID(),
      code: parsed.roomCode,
      hostId: userId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      return c.json({ error: 'room_code_conflict' }, 409);
    }
    throw err;
  }

  // Initialize DO state (if initialState provided)
  if (parsed.initialState) {
    try {
      const stub = getGameRoomStub(env, parsed.roomCode);
      await stub.init(parsed.initialState as GameState);
    } catch (err) {
      // DO init failed → rollback D1 record
      await db.delete(rooms).where(eq(rooms.code, parsed.roomCode));
      throw err;
    }
  }

  return c.json(
    {
      room: {
        roomNumber: parsed.roomCode,
        hostUid: userId,
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
      hostId: rooms.hostId,
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
        roomNumber: row.code,
        hostUid: row.hostId,
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
    .where(and(eq(rooms.code, parsed.roomCode), eq(rooms.hostId, userId)))
    .returning({ id: rooms.id });

  if (result.length === 0) {
    return c.json({ error: 'room not found or not authorized' }, 403);
  }

  // Clean up DO storage (non-critical path, failure does not block)
  try {
    const stub = getGameRoomStub(env, parsed.roomCode);
    await stub.cleanup();
  } catch {
    // DO cleanup failure does not affect delete result.
    // Stale DO storage will be cleaned up by cron.
  }

  return c.json({ success: true }, 200);
});

// ── POST /room/state ────────────────────────────────────────────────────────
// 从 DO 读取完整 state + revision
roomRoutes.post('/state', jsonBody(roomCodeBodySchema), async (c) => {
  const parsed = c.req.valid('json');

  const stub = getGameRoomStub(c.env, parsed.roomCode);
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
// 轻量级：只读 revision 数字（从 DO 读取）
roomRoutes.post('/revision', jsonBody(roomCodeBodySchema), async (c) => {
  const parsed = c.req.valid('json');

  const stub = getGameRoomStub(c.env, parsed.roomCode);
  const revision = await stub.getRevision();

  return c.json({ revision }, 200);
});

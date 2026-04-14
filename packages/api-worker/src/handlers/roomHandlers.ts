/**
 * handlers/roomHandlers — 房间 CRUD Hono routes（Workers 版）
 *
 * /room/create、/room/get、/room/delete — D1 元数据操作。
 * /room/state、/room/revision — 从 DO 读取游戏状态。
 * create/delete 需要与 DO 双向同步。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createRoomSchema, roomCodeBodySchema } from '../schemas/room';
import { getGameRoomStub, jsonBody } from './shared';

export const roomRoutes = new Hono<AppEnv>();

// ── POST /room/create ───────────────────────────────────────────────────────
roomRoutes.post('/create', requireAuth, jsonBody(createRoomSchema), async (c) => {
  const env = c.env;
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  const params: string[] = [crypto.randomUUID(), parsed.roomCode, userId];
  const sql = 'INSERT INTO rooms (id, code, host_id) VALUES (?, ?, ?)';

  try {
    await env.DB.prepare(sql)
      .bind(...params)
      .run();
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
      await env.DB.prepare('DELETE FROM rooms WHERE code = ?').bind(parsed.roomCode).run();
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
  const env = c.env;
  const parsed = c.req.valid('json');

  const row = await env.DB.prepare('SELECT id, code, host_id, created_at FROM rooms WHERE code = ?')
    .bind(parsed.roomCode)
    .first<{ id: string; code: string; host_id: string; created_at: string }>();

  if (!row) {
    return c.json({ room: null }, 200);
  }

  return c.json(
    {
      room: {
        roomNumber: row.code,
        hostUid: row.host_id,
        createdAt: row.created_at,
      },
    },
    200,
  );
});

// ── POST /room/delete ───────────────────────────────────────────────────────
roomRoutes.post('/delete', requireAuth, jsonBody(roomCodeBodySchema), async (c) => {
  const env = c.env;
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  // Only the room host can delete the room
  const result = await env.DB.prepare('DELETE FROM rooms WHERE code = ? AND host_id = ?')
    .bind(parsed.roomCode, userId)
    .run();

  if (!result.meta.changes) {
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

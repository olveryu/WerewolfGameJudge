/**
 * handlers/roomHandlers — 房间 CRUD API（Workers 版）
 *
 * /room/create、/room/get、/room/delete — D1 元数据操作。
 * /room/state、/room/revision — 从 DO 读取游戏状态。
 * create/delete 需要与 DO 双向同步。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { Env } from '../env';
import { extractBearerToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import { createRoomSchema, roomCodeBodySchema } from '../schemas/room';
import { getGameRoomStub, parseBody } from './shared';

// ── POST /room/create ───────────────────────────────────────────────────────
export async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  const parsed = await parseBody(request, createRoomSchema, env);
  if (parsed instanceof Response) return parsed;

  const params: string[] = [crypto.randomUUID(), parsed.roomCode, payload.sub];
  const sql = 'INSERT INTO rooms (id, code, host_id) VALUES (?, ?, ?)';

  try {
    await env.DB.prepare(sql)
      .bind(...params)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      return jsonResponse({ error: 'room_code_conflict' }, 409, env);
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

  return jsonResponse(
    {
      room: {
        roomNumber: parsed.roomCode,
        hostUid: payload.sub,
        createdAt: new Date().toISOString(),
      },
    },
    200,
    env,
  );
}

// ── POST /room/get ──────────────────────────────────────────────────────────
export async function handleGetRoom(request: Request, env: Env): Promise<Response> {
  const parsed = await parseBody(request, roomCodeBodySchema, env);
  if (parsed instanceof Response) return parsed;

  const row = await env.DB.prepare('SELECT id, code, host_id, created_at FROM rooms WHERE code = ?')
    .bind(parsed.roomCode)
    .first<{ id: string; code: string; host_id: string; created_at: string }>();

  if (!row) {
    return jsonResponse({ room: null }, 200, env);
  }

  return jsonResponse(
    {
      room: {
        roomNumber: row.code,
        hostUid: row.host_id,
        createdAt: row.created_at,
      },
    },
    200,
    env,
  );
}

// ── POST /room/delete ───────────────────────────────────────────────────────
export async function handleDeleteRoom(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  const parsed = await parseBody(request, roomCodeBodySchema, env);
  if (parsed instanceof Response) return parsed;

  // Only the room host can delete the room
  const result = await env.DB.prepare('DELETE FROM rooms WHERE code = ? AND host_id = ?')
    .bind(parsed.roomCode, payload.sub)
    .run();

  if (!result.meta.changes) {
    return jsonResponse({ error: 'room not found or not authorized' }, 403, env);
  }

  // Clean up DO storage (non-critical path, failure does not block)
  try {
    const stub = getGameRoomStub(env, parsed.roomCode);
    await stub.cleanup();
  } catch {
    // DO cleanup failure does not affect delete result.
    // Stale DO storage will be cleaned up by cron.
  }

  return jsonResponse({ success: true }, 200, env);
}

// ── POST /room/state ────────────────────────────────────────────────────────
// 从 DO 读取完整 state + revision
export async function handleGetGameState(request: Request, env: Env): Promise<Response> {
  const parsed = await parseBody(request, roomCodeBodySchema, env);
  if (parsed instanceof Response) return parsed;

  const stub = getGameRoomStub(env, parsed.roomCode);
  const result = await stub.getState();

  if (!result) {
    return jsonResponse({ state: null }, 200, env);
  }

  return jsonResponse(
    {
      state: result.state,
      revision: result.revision,
    },
    200,
    env,
  );
}

// ── POST /room/revision ─────────────────────────────────────────────────────
// 轻量级：只读 revision 数字（从 DO 读取）
export async function handleGetRevision(request: Request, env: Env): Promise<Response> {
  const parsed = await parseBody(request, roomCodeBodySchema, env);
  if (parsed instanceof Response) return parsed;

  const stub = getGameRoomStub(env, parsed.roomCode);
  const revision = await stub.getRevision();

  return jsonResponse({ revision }, 200, env);
}

/**
 * handlers/roomHandlers — 房间 CRUD API（Workers 版）
 *
 * 提供 /room/create、/room/get、/room/delete、/room/state、/room/revision 端点。
 * D1 直读直写，不经过 game-engine handler。
 */

import type { Env } from '../env';
import { extractBearerToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';

// ── POST /room/create ───────────────────────────────────────────────────────
export async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  const body = (await request.json()) as {
    roomCode?: string;
    initialState?: unknown;
  };

  if (!body.roomCode) {
    return jsonResponse({ error: 'roomCode required' }, 400, env);
  }

  const params: string[] = [crypto.randomUUID(), body.roomCode, payload.sub];
  let sql = 'INSERT INTO rooms (id, code, host_id) VALUES (?, ?, ?)';

  if (body.initialState) {
    sql =
      'INSERT INTO rooms (id, code, host_id, game_state, state_revision) VALUES (?, ?, ?, ?, 1)';
    params.push(JSON.stringify(body.initialState));
  }

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

  return jsonResponse(
    {
      room: {
        roomNumber: body.roomCode,
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
  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) {
    return jsonResponse({ error: 'roomCode required' }, 400, env);
  }

  const row = await env.DB.prepare('SELECT id, code, host_id, created_at FROM rooms WHERE code = ?')
    .bind(body.roomCode)
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

  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) {
    return jsonResponse({ error: 'roomCode required' }, 400, env);
  }

  // Only the room host can delete the room
  const result = await env.DB.prepare('DELETE FROM rooms WHERE code = ? AND host_id = ?')
    .bind(body.roomCode, payload.sub)
    .run();

  if (!result.meta.changes) {
    return jsonResponse({ error: 'room not found or not authorized' }, 403, env);
  }

  return jsonResponse({ success: true }, 200, env);
}

// ── POST /room/state ────────────────────────────────────────────────────────
// 读取完整 game_state + revision
export async function handleGetGameState(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) {
    return jsonResponse({ error: 'roomCode required' }, 400, env);
  }

  const row = await env.DB.prepare('SELECT game_state, state_revision FROM rooms WHERE code = ?')
    .bind(body.roomCode)
    .first<{ game_state: string | null; state_revision: number }>();

  if (!row?.game_state) {
    return jsonResponse({ state: null }, 200, env);
  }

  return jsonResponse(
    {
      state: JSON.parse(row.game_state),
      revision: row.state_revision,
    },
    200,
    env,
  );
}

// ── POST /room/revision ─────────────────────────────────────────────────────
// 轻量级：只读 revision 数字
export async function handleGetRevision(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) {
    return jsonResponse({ error: 'roomCode required' }, 400, env);
  }

  const row = await env.DB.prepare('SELECT state_revision FROM rooms WHERE code = ?')
    .bind(body.roomCode)
    .first<{ state_revision: number }>();

  return jsonResponse({ revision: row?.state_revision ?? null }, 200, env);
}

/**
 * games/fibking/handlers/fibRoutes — fibking REST routes.
 *
 * Thin, isolated per-game module (not a shared god object): zod-validate → host-check
 * at the boundary → generic DO `engineAction(actionType, payload)`. The two-phase start/next
 * round draws the word in the Worker (never the DO, never the client) between BEGIN_DRAW
 * and START_ROUND.
 *
 * @throws 401 — requireAuth failed
 * @throws 403 — caller is not the room host (host-only actions)
 * @throws 404 — room not found
 * @throws 400 — zod validation / engine precondition failure
 * @throws 500 — word generation bug (after the guaranteed bank fallback)
 */

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../../../db';
import { rooms } from '../../../db/schema';
import type { DispatchResult } from '../../../durableObjects/processEngineAction';
import type { AppEnv, Env } from '../../../env';
import { dispatchEngineAction, jsonBody, resultToStatus } from '../../../handlers/shared';
import { requireAuth } from '../../../lib/auth';
import { createLogger } from '../../../lib/logger';
import {
  fibKickSchema,
  fibRoomCodeSchema,
  fibSitSchema,
  fibUpdateConfigSchema,
} from '../schemas/fibSchemas';
import { generateFibWord } from '../services/fibWordSource';

const log = createLogger('fib');

export const fibRoutes = new Hono<AppEnv>();

type HostCheck = { ok: true } | { ok: false; status: 403 | 404; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readUsedWords(state: unknown): string[] {
  if (!isRecord(state) || !('usedWords' in state)) {
    throw new Error('[FAIL-FAST] FibState.usedWords missing after BEGIN_DRAW');
  }
  const usedWords = state.usedWords;
  if (!isStringArray(usedWords)) {
    throw new Error('[FAIL-FAST] FibState.usedWords must be a string array');
  }
  return usedWords;
}

/** Verify the caller is the room host (host-only actions). Uses D1 (host = creator, no transfer). */
async function checkHost(env: Env, userId: string, roomCode: string): Promise<HostCheck> {
  const db = createDb(env.DB);
  const row = await db
    .select({ hostUserId: rooms.hostUserId })
    .from(rooms)
    .where(eq(rooms.code, roomCode))
    .get();
  if (!row) return { ok: false, status: 404, reason: 'ROOM_NOT_FOUND' };
  if (row.hostUserId !== userId) return { ok: false, status: 403, reason: 'NOT_HOST' };
  return { ok: true };
}

/** Two-phase: BEGIN_DRAW (guard + Starting) → draw word in Worker → START_ROUND (Playing). */
async function runStartRound(
  env: Env,
  req: Request,
  roomCode: string,
): Promise<{ body: unknown; status: 200 | 400 | 500 }> {
  const begin: DispatchResult = await dispatchEngineAction(env, roomCode, req, 'BEGIN_DRAW', {});
  if (!begin.success) return { body: begin, status: resultToStatus(begin) };

  const avoid = readUsedWords(begin.state);
  try {
    const drawn = await generateFibWord(env, { avoid });
    const started: DispatchResult = await dispatchEngineAction(env, roomCode, req, 'START_ROUND', {
      word: drawn.word,
      definition: drawn.definition,
      source: drawn.source,
    });
    return { body: started, status: resultToStatus(started) };
  } catch (err) {
    // Word generation has a guaranteed bank fallback, so reaching here = a real bug.
    log.error('word generation failed, aborting draw', {
      roomCode,
      error: err instanceof Error ? err.message : String(err),
    });
    await dispatchEngineAction(env, roomCode, req, 'ABORT_DRAW', {});
    return { body: { success: false, reason: 'WORD_GEN_FAILED' }, status: 500 };
  }
}

// ── Seat actions (any authenticated player; Lobby-only enforced by the engine) ──

fibRoutes.post('/sit', requireAuth, jsonBody(fibSitSchema), async (c) => {
  const { roomCode, seat, profile } = c.req.valid('json');
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'SIT', {
    userId: c.var.userId,
    seat,
    profile,
  });
  return c.json(result, resultToStatus(result));
});

fibRoutes.post('/leave', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'LEAVE', {
    userId: c.var.userId,
  });
  return c.json(result, resultToStatus(result));
});

// ── Host-only seat management ──────────────────────────────────────────────

fibRoutes.post('/kick', requireAuth, jsonBody(fibKickSchema), async (c) => {
  const { roomCode, targetSeat } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'KICK', { targetSeat });
  return c.json(result, resultToStatus(result));
});

fibRoutes.post('/clear-seats', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'CLEAR_SEATS', {});
  return c.json(result, resultToStatus(result));
});

fibRoutes.post('/fill-bots', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'FILL_BOTS', {});
  return c.json(result, resultToStatus(result));
});

fibRoutes.post('/update-config', requireAuth, jsonBody(fibUpdateConfigSchema), async (c) => {
  const { roomCode, numberOfPlayers } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'UPDATE_CONFIG', {
    numberOfPlayers,
  });
  return c.json(result, resultToStatus(result));
});

// ── Host-only round control ────────────────────────────────────────────────

fibRoutes.post('/start-round', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const r = await runStartRound(c.env, c.req.raw, roomCode);
  return c.json(r.body, r.status);
});

fibRoutes.post('/next-round', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  // next-round = BEGIN_DRAW (allowed from Revealed) → draw → START_ROUND; usedWords preserved.
  const r = await runStartRound(c.env, c.req.raw, roomCode);
  return c.json(r.body, r.status);
});

fibRoutes.post('/reveal', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'REVEAL', {});
  return c.json(result, resultToStatus(result));
});

fibRoutes.post('/restart', requireAuth, jsonBody(fibRoomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const host = await checkHost(c.env, c.var.userId, roomCode);
  if (!host.ok) return c.json({ success: false, reason: host.reason }, host.status);
  const result = await dispatchEngineAction(c.env, roomCode, c.req.raw, 'RESTART', {});
  return c.json(result, resultToStatus(result));
});

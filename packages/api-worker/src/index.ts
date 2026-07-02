/**
 * Werewolf API Worker -- Hono app entry point
 *
 * Declarative routes; CORS / error-handling middleware managed centrally.
 * Each handler file exports a Hono route group; this file composes them.
 *
 * Route structure:
 *   POST /auth/anonymous          -- anonymous sign-in
 *   POST /auth/signup             -- email signup
 *   POST /auth/signin             -- email sign-in
 *   GET  /auth/user               -- get current user
 *   PUT  /auth/profile            -- update profile
 *   POST /auth/signout            -- sign out
 *   POST /auth/forgot-password    -- send password reset code
 *   POST /auth/reset-password     -- reset password with code
 *   POST /game/{assign,seat,...}  -- game control API
 *   POST /game/night/{action,...} -- night flow API
 *   POST /gemini-proxy            -- Gemini AI proxy
 *   GET  /health                  -- health check
 */

import * as Sentry from '@sentry/cloudflare';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import type { AppEnv, Env } from './env';
import { createLogger } from './lib/logger';

// Re-export Durable Object class for wrangler
export { GameRoom } from './durableObjects/GameRoom';
export { WeChatAuthProxy } from './durableObjects/WeChatAuthProxy';

// Route groups
import { fibRoutes } from './games/fibking/handlers/fibRoutes';
import { gameRoutes } from './games/werewolf/handlers/gameControlRoutes';
import { nightRoutes } from './games/werewolf/handlers/nightRoutes';
import { adminRoutes } from './handlers/adminHandlers';
import { authRoutes } from './handlers/authHandlers';
import { avatarRoutes } from './handlers/avatarUpload';
import { runScheduledCleanup } from './handlers/cronHandlers';
import { feedbackRoutes, feedbackWebhookRoutes } from './handlers/feedbackHandlers';
import { gachaRoutes } from './handlers/gachaHandlers';
import { geminiRoutes } from './handlers/geminiProxy';
import { roomRoutes } from './handlers/roomHandlers';
import { callDO, getGameRoomStub } from './handlers/shared';
import { shareRoutes } from './handlers/shareImage';
import { statsRoutes } from './handlers/statsHandlers';
import { telemetryRoutes } from './handlers/telemetryHandlers';

// ── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<AppEnv>();

const log = createLogger('worker');

// ── CORS middleware ─────────────────────────────────────────────────────────

app.use(
  '*',
  cors({
    origin: (_, c) => (c.env as Env).CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-region', 'x-request-id', 'x-admin-token'],
    maxAge: 3600,
  }),
);

// ── Request logging middleware ──────────────────────────────────────────────

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  log.info('request', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    country: cf?.country,
    colo: cf?.colo,
    ms: Date.now() - start,
  });
});

// ── Error handler ───────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, reason: err.message }, err.status);
  }
  if (err instanceof SyntaxError) {
    return c.json({ success: false, reason: 'INVALID_JSON' }, 400);
  }
  log.warn('unhandled error', { error: err instanceof Error ? err.message : String(err) });
  // Capture the original Error object to preserve stack trace in Sentry
  Sentry.captureException(err, {
    tags: { path: c.req.path, method: c.req.method },
  });
  return c.json({ success: false, reason: 'INTERNAL_ERROR' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok' }));

// ── WebSocket upgrade → Durable Object ──────────────────────────────────────

app.get('/ws', async (c) => {
  const roomCode = c.req.query('roomCode');
  const token = c.req.query('token');
  if (!roomCode) {
    return c.json({ error: 'roomCode required' }, 400);
  }
  if (!token) {
    return c.json({ error: 'token required' }, 401);
  }

  // Verify JWT before allowing WebSocket upgrade
  const { verifyToken } = await import('./lib/auth');
  const payload = await verifyToken(token, c.env);
  if (!payload) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const stub = getGameRoomStub(c.env, roomCode, c.req.raw);
  const doUrl = new URL(c.req.url);
  doUrl.pathname = '/websocket';
  // Pass verified userId (from JWT) to DO instead of trusting client-provided userId
  doUrl.searchParams.set('userId', payload.sub);
  return await callDO(() => stub.fetch(new Request(doUrl.toString(), c.req.raw)));
});

// ── Route groups ────────────────────────────────────────────────────────────

app.route('/admin', adminRoutes);
app.route('/auth', authRoutes);
app.route('/room', roomRoutes);
app.route('/fib', fibRoutes);
app.route('/game/night', nightRoutes);
app.route('/game', gameRoutes);
app.route('/gemini-proxy', geminiRoutes);
app.route('/avatar', avatarRoutes);
app.route('/share', shareRoutes);
app.route('/api', statsRoutes);
app.route('/api', gachaRoutes);
app.route('/api', feedbackRoutes);
app.route('/api', feedbackWebhookRoutes);
app.route('/telemetry', telemetryRoutes);

// ── Worker entry ────────────────────────────────────────────────────────────

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
    sendDefaultPii: true,
    enableLogs: true,
  }),
  {
    fetch: app.fetch,
    async scheduled(
      controller: ScheduledController,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<void> {
      ctx.waitUntil(runScheduledCleanup(env));
    },
  } satisfies ExportedHandler<Env>,
);

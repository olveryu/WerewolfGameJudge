/**
 * Game Judge API Worker -- Hono app entry point
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
 *   POST /room/command            -- authenticated game command API
 *   *    /api/games/:gameType/*  -- game-owned HTTP capabilities
 *   GET  /health                  -- health check
 */

import * as Sentry from '@sentry/cloudflare';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { runScheduledCron } from './app/scheduled';
import type { AppEnv, Env } from './env';
import { accountAuthRoutes } from './features/account/authRoutes';
import { avatarRoutes } from './features/account/avatarRoutes';
import { accountRoutes } from './features/account/routes';
import { readMaintenance } from './features/admin/maintenance';
import { adminRoutes } from './features/admin/routes';
import { authRoutes } from './features/auth/routes';
import { authenticateAccessToken, requireAuth } from './features/auth/tokenAuth';
import { feedbackRoutes, feedbackWebhookRoutes } from './features/feedback/routes';
import { gachaRoutes } from './features/gacha/routes';
import { shareRoutes } from './features/sharing/routes';
import { wordSubmissionRoutes } from './features/wordSubmissions/routes';
import { getWorkerGameModule, WORKER_GAME_HTTP_ROUTES } from './games/catalog';
import { publicGameStatsRoutes } from './games/publicStatsRoutes';
import { readCloudflareRequestMetadata } from './platform/http/requestMetadata';
import { createLogger } from './platform/observability/logger';
import { createSentryOptions } from './platform/observability/sentryOptions';
import { createRoomSocketHandler } from './platform/realtime/gatewayRoute';
import { createRoomRoutes } from './platform/room/routes';
import {
  recordHttpRequestTraffic,
  resolveHttpRequestRoute,
  UNKNOWN_TRAFFIC_DIMENSION,
} from './platform/telemetry/requestTraffic';
import { telemetryRoutes } from './platform/telemetry/routes';

// Re-export Durable Object class for wrangler
export { GameRoom } from './app/GameRoom';
export { WeChatAuthProxy } from './features/auth/wechat/WeChatAuthProxy';
export { WordSubmissionReviewWorkflow } from './features/wordSubmissions/reviewWorkflow';
export { DrawGuessWordSupplyWorkflow } from './games/drawguess/wordSupplyWorkflow';
export { FibWordSupplyWorkflow } from './games/fibking/wordSupplyWorkflow';
export { UndercoverWordSupplyWorkflow } from './games/undercover/wordSupplyWorkflow';

// ── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<AppEnv>();
const roomRoutes = createRoomRoutes(getWorkerGameModule, requireAuth);
const roomWebSocketHandler = createRoomSocketHandler(async (token, env) => {
  const authentication = await authenticateAccessToken(token, env);
  return authentication.kind === 'authenticated' ? authentication.principal.userId : null;
});

const log = createLogger('worker');

function resolveContextRequestRoute(method: string, registeredRoutePath: string): string {
  return resolveHttpRequestRoute({
    method,
    registeredRoutePath,
  });
}

// ── Request telemetry and logging middleware ────────────────────────────────

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const metadata = readCloudflareRequestMetadata(c.req.raw);
  const durationMs = Date.now() - start;
  const requestRoute = resolveContextRequestRoute(
    c.req.method,
    c.req.matchedRoutes.at(-1)?.path ?? '',
  );
  log.info('request', {
    method: c.req.method,
    route: requestRoute,
    status: c.res.status,
    country: metadata.country,
    colo: metadata.colo,
    ms: durationMs,
  });
  recordHttpRequestTraffic(c.env.REQUEST_TRAFFIC, {
    method: c.req.method,
    route: requestRoute,
    status: c.res.status,
    durationMs,
    country: metadata.country ?? UNKNOWN_TRAFFIC_DIMENSION,
    colo: metadata.colo ?? UNKNOWN_TRAFFIC_DIMENSION,
    deploymentId: c.env.CF_VERSION_METADATA.id,
  });
});

// ── CORS middleware ─────────────────────────────────────────────────────────

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'x-region',
      'x-request-id',
      'x-admin-token',
    ],
    maxAge: 3600,
  }),
);

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
    tags: {
      route: resolveContextRequestRoute(c.req.method, c.req.matchedRoutes.at(-1)?.path ?? ''),
      method: c.req.method,
    },
  });
  return c.json({ success: false, reason: 'INTERNAL_ERROR' }, 500);
});

app.notFound((c) => c.json({ error: 'not found' }, 404));

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/time', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ serverNowMs: Date.now() });
});

app.get('/maintenance', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(await readMaintenance(c.env));
});

// ── WebSocket upgrade → Durable Object ──────────────────────────────────────

app.get('/ws', roomWebSocketHandler);

// ── Route groups ────────────────────────────────────────────────────────────

app.route('/admin', adminRoutes);
app.route('/v1', wordSubmissionRoutes);
app.route('/auth', authRoutes);
app.route('/auth', accountAuthRoutes);
app.route('/room', roomRoutes);
for (const route of WORKER_GAME_HTTP_ROUTES) {
  app.route(route.path, route.router);
}
app.route('/avatar', avatarRoutes);
app.route('/share', shareRoutes);
app.route('/api', accountRoutes);
app.route('/api', publicGameStatsRoutes);
app.route('/api', gachaRoutes);
app.route('/api', feedbackRoutes);
app.route('/api', feedbackWebhookRoutes);
app.route('/telemetry', telemetryRoutes);

// ── Worker entry ────────────────────────────────────────────────────────────

export default Sentry.withSentry(
  (env: Env) => ({
    ...createSentryOptions(env, true),
    release: env.CF_VERSION_METADATA.id,
  }),
  {
    fetch: app.fetch,
    async scheduled(
      controller: ScheduledController,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<void> {
      ctx.waitUntil(runScheduledCron(env, controller.cron, controller.scheduledTime));
    },
  } satisfies ExportedHandler<Env>,
);

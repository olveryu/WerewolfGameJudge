/**
 * Werewolf API Worker — Hono app entry point
 *
 * 声明式路由，CORS / 错误处理中间件统一管理。
 * Handler 文件各自导出 Hono route group，此文件负责组合。
 *
 * 路由结构：
 *   POST /auth/anonymous          — 匿名登录
 *   POST /auth/signup             — 邮箱注册
 *   POST /auth/signin             — 邮箱登录
 *   GET  /auth/user               — 获取当前用户
 *   PUT  /auth/profile            — 更新资料
 *   POST /auth/signout            — 登出
 *   POST /auth/forgot-password    — 发送密码重置验证码
 *   POST /auth/reset-password     — 验证码重置密码
 *   POST /game/{assign,seat,...}  — 游戏控制 API
 *   POST /game/night/{action,...} — 夜晚流程 API
 *   POST /gemini-proxy            — Gemini AI 代理
 *   GET  /health                  — 健康检查
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
import { authRoutes } from './handlers/authHandlers';
import { avatarRoutes } from './handlers/avatarUpload';
import { runScheduledCleanup } from './handlers/cronHandlers';
import { gachaRoutes } from './handlers/gachaHandlers';
import { gameRoutes } from './handlers/gameControl';
import { geminiRoutes } from './handlers/geminiProxy';
import { nightRoutes } from './handlers/night';
import { roomRoutes } from './handlers/roomHandlers';
import { getGameRoomStub } from './handlers/shared';
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
    origin: (_, c) => c.env.CORS_ORIGIN ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-region', 'x-request-id'],
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
  log.error('unhandled error', { error: err instanceof Error ? err.message : String(err) });
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
  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
});

// ── Route groups ────────────────────────────────────────────────────────────

app.route('/auth', authRoutes);
app.route('/room', roomRoutes);
app.route('/game/night', nightRoutes);
app.route('/game', gameRoutes);
app.route('/gemini-proxy', geminiRoutes);
app.route('/avatar', avatarRoutes);
app.route('/share', shareRoutes);
app.route('/api', statsRoutes);
app.route('/api', gachaRoutes);
app.route('/telemetry', telemetryRoutes);

// ── Worker entry ────────────────────────────────────────────────────────────

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
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

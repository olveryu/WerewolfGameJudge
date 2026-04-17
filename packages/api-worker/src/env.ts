/**
 * Env — Cloudflare Worker 绑定类型定义
 *
 * 声明 D1、R2、DO 绑定和环境变量，与 wrangler.toml 保持一致。
 * Phase 2/3 解注释后启用 GAME_ROOM / AVATARS。
 */

export interface Env {
  // ── D1 Database ─────────────────────────────────────────────────
  DB: D1Database;

  // ── R2 Bucket (Phase 3) ────────────────────────────────────────
  AVATARS: R2Bucket;

  // ── Durable Objects ─────────────────────────────────────────────
  GAME_ROOM: DurableObjectNamespace<import('./durableObjects/GameRoom').GameRoom>;
  // ── Workers AI ─────────────────────────────────────────────────────
  AI: Ai;
  // ── Environment Variables ──────────────────────────────────────
  ENVIRONMENT: string;
  CORS_ORIGIN: string;

  /** JWT signing secret — set via `wrangler secret put JWT_SECRET` */
  JWT_SECRET: string;

  /** Gemini API key — set via `wrangler secret put GEMINI_API_KEY` */
  GEMINI_API_KEY?: string;

  /** Resend API key — set via `wrangler secret put RESEND_API_KEY` */
  RESEND_API_KEY?: string;

  /** WeChat Mini Program AppID — set via `wrangler secret put WECHAT_APP_ID` */
  WECHAT_APP_ID?: string;

  /** WeChat Mini Program AppSecret — set via `wrangler secret put WECHAT_APP_SECRET` */
  WECHAT_APP_SECRET?: string;
}

/** Hono app environment type (Bindings = Worker Env) */
export type AppEnv = { Bindings: Env };

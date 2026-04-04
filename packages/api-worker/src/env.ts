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

  // ── Durable Objects (Phase 2) ──────────────────────────────────
  GAME_ROOM: DurableObjectNamespace;

  // ── Environment Variables ──────────────────────────────────────
  ENVIRONMENT: string;
  CORS_ORIGIN: string;

  /** JWT signing secret — set via `wrangler secret put JWT_SECRET` */
  JWT_SECRET: string;

  /** Gemini API key — set via `wrangler secret put GEMINI_API_KEY` */
  GEMINI_API_KEY?: string;
}

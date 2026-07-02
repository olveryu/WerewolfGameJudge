/**
 * Env — Cloudflare Worker binding type definitions
 *
 * Declares D1, R2, and DO bindings plus environment variables; kept in sync with wrangler.toml.
 * Uncomment in Phase 2/3 to enable GAME_ROOM / AVATARS.
 */

export interface Env {
  // ── D1 Database ─────────────────────────────────────────────────
  DB: D1Database;

  // ── R2 Bucket (Phase 3) ────────────────────────────────────────
  AVATARS: R2Bucket;

  // ── Durable Objects ─────────────────────────────────────────────
  GAME_ROOM: DurableObjectNamespace<import('./durableObjects/IGameRoomRPC').IGameRoomRPC>;
  WECHAT_AUTH: DurableObjectNamespace<import('./durableObjects/WeChatAuthProxy').WeChatAuthProxy>;
  // ── Workers AI ─────────────────────────────────────────────────────
  AI: Ai;
  // ── Analytics Engine (load timing telemetry) ────────────────────────
  LOAD_TIMING: AnalyticsEngineDataset;
  // ── Analytics Engine (AI chat usage telemetry) ─────────────────────
  AI_USAGE: AnalyticsEngineDataset;
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

  /** Sentry DSN for error reporting */
  SENTRY_DSN: string;

  /** Cloudflare version metadata — auto-injected, used for Sentry release */
  CF_VERSION_METADATA: { id: string; tag: string };

  /** GitHub PAT (fine-grained, Issues write) for user feedback → GitHub Issues */
  GITHUB_TOKEN?: string;

  /** GitHub Webhook secret for issue_comment event signature verification */
  GITHUB_WEBHOOK_SECRET?: string;

  /** GitHub repo owner login — used to identify admin comments in webhook */
  GITHUB_REPO_OWNER?: string;

  /** Admin portal password — set via `wrangler secret put ADMIN_PASSWORD` */
  ADMIN_PASSWORD: string;

  /** Cloudflare API token for Analytics Engine reads — set via `wrangler secret put CF_API_TOKEN` */
  CF_API_TOKEN?: string;
}

/** Hono app environment type (Bindings = Worker Env) */
export type AppEnv = { Bindings: Env };

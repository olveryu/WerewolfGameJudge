/**
 * api - API base URL 配置
 *
 * 根据 EXPO_PUBLIC_BACKEND 环境变量选择 Supabase Edge Functions 或 Cloudflare Workers。
 * 纯配置模块，不包含业务逻辑或副作用。
 */

type BackendType = 'supabase' | 'cloudflare';
const BACKEND: BackendType =
  (process.env.EXPO_PUBLIC_BACKEND as BackendType | undefined) ?? 'supabase';

/**
 * Supabase Edge Functions base URL
 */
const SUPABASE_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://abmzjezdvpzyeooqhhsn.supabase.co/functions/v1';

/**
 * Cloudflare Workers base URL
 */
const CF_API_URL = process.env.EXPO_PUBLIC_CF_API_URL ?? 'https://werewolf-api.olveryu.workers.dev';

/**
 * API base URL — 根据后端选择自动切换
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (BACKEND === 'cloudflare' ? CF_API_URL : SUPABASE_API_URL);

/**
 * Edge Function 区域路由 header 值。
 *
 * - 可通过 EXPO_PUBLIC_API_REGION 覆盖（例如 `ap-southeast-1`）
 * - 默认值保持现有生产配置
 */
export const API_REGION: string = process.env.EXPO_PUBLIC_API_REGION ?? 'us-west-1';

/**
 * API 请求超时时间（毫秒）。
 *
 * - 可通过 EXPO_PUBLIC_API_TIMEOUT_MS 覆盖
 * - 默认 8000ms，和 realtime subscribe timeout 对齐
 */
export const API_TIMEOUT_MS: number = (() => {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  if (!raw) return 8000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
})();

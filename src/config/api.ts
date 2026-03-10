/**
 * api - API base URL 配置
 *
 * 提供 Supabase Edge Functions 的 base URL，导出 API_BASE_URL。
 * 生产环境指向 Supabase Edge Functions，开发环境可通过环境变量覆盖。
 * 纯配置模块，不包含业务逻辑或副作用。
 */

/**
 * API base URL
 *
 * - 生产环境（Supabase Edge Functions）：`https://<project-ref>.supabase.co/functions/v1`
 * - 开发环境：可通过 EXPO_PUBLIC_API_URL 覆盖（如 `http://localhost:54321/functions/v1`）
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://abmzjezdvpzyeooqhhsn.supabase.co/functions/v1';

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

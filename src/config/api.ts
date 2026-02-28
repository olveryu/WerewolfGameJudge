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

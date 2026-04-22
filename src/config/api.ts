/**
 * api - API / Site URL 配置
 *
 * Cloudflare Workers 后端 + 前端站点 URL。纯配置模块，不包含业务逻辑或副作用。
 */

/**
 * 前端站点 URL（自定义域名）。
 * Native 端分享链接、deep link prefix 等消费。
 */
export const SITE_URL: string = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://werewolfjudge.eu.org';

/**
 * Cloudflare Workers base URL
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_CF_API_URL ?? 'https://api.werewolfjudge.eu.org';

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
 * - 默认 12000ms，国内 → CF 首次 TLS 握手可达 3-5s
 */
export const API_TIMEOUT_MS: number = (() => {
  const raw = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  if (!raw) return 12000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12000;
})();

/** 网络层 fetch 重试次数（仅重试 fetch() 抛异常，不重试 HTTP 错误响应） */
export const FETCH_RETRY_COUNT = 2;

/** 网络层 fetch 重试基础退避时间（毫秒），指数退避：1s, 2s */
export const FETCH_RETRY_BASE_MS = 1000;

/**
 * api - API base URL 配置
 *
 * 提供 Vercel Serverless Functions 的 base URL，导出 API_BASE_URL。
 * 生产环境使用相对路径（同域），开发环境可通过环境变量覆盖。
 * 纯配置模块，不包含业务逻辑或副作用。
 */

/**
 * API base URL
 *
 * - 生产环境（Vercel 部署）：空字符串（相对路径 `/api/...`）
 * - 开发环境：可通过 EXPO_PUBLIC_API_URL 覆盖（如 `http://localhost:3000`）
 */
export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? '';

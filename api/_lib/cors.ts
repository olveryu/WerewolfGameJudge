/**
 * CORS helper for local two-process development.
 *
 * In production (same domain), CORS is not needed.
 * In local dev, the frontend runs on port 8081 (Metro) while
 * API runs on port 3000 (vercel dev), requiring cross-origin headers.
 * 提供 CORS preflight 响应与 dev origins 的跨域 headers，不包含业务逻辑或 state 操作。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Origins allowed for CORS in local development */
const DEV_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081'];

/**
 * Add CORS headers if the request origin is a known dev origin.
 * Returns `true` if this was a preflight (OPTIONS) that was handled —
 * caller should `return` immediately.
 *
 * Usage:
 * ```ts
 * export default async function handler(req, res) {
 *   if (handleCors(req, res)) return;
 *   // ... rest of handler
 * }
 * ```
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (origin && DEV_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

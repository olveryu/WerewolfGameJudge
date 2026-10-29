/**
 * Rate limiting through the Cloudflare Workers Rate Limiting binding.
 *
 * Every limited surface calls `takeRateLimitToken(binding, key)` and answers 429
 * `RATE_LIMITED` (HTTP) or closes 4004 (WebSocket) when the token is refused. Limits and
 * windows live in wrangler.toml (`[[ratelimits]]`), never in code.
 */

export const REASON_RATE_LIMITED = 'RATE_LIMITED';

/** True when `key` still has budget in the binding's window; false when it must be refused. */
export async function takeRateLimitToken(limiter: RateLimit, key: string): Promise<boolean> {
  if (key.length === 0) throw new Error('Rate limit key must be non-empty');
  const { success } = await limiter.limit({ key });
  return success;
}

/**
 * Client address for unauthenticated budgets. Cloudflare always sets `CF-Connecting-IP` on
 * requests that reach a Worker; its absence means the request did not come through the edge.
 */
export function requestClientIp(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip === null || ip.length === 0) {
    throw new Error('Request is missing CF-Connecting-IP');
  }
  return ip;
}

/**
 * CORS + JSON response helpers
 *
 * 与 Edge Functions 的 cors.ts 逻辑一致：
 * Access-Control-Allow-Origin 从 env.CORS_ORIGIN 读取（默认 '*'）。
 */

import type { Env } from '../env';

export function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-region, x-request-id',
  };
}

export function jsonResponse(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

export function corsPreflightResponse(env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(env),
      'Access-Control-Max-Age': '3600',
    },
  });
}

/**
 * Server-side Supabase Client
 *
 * 使用 service role key 创建 Supabase 客户端，绕过 RLS。
 * 仅在 Vercel Serverless Functions 中使用。
 *
 * ✅ 允许：创建 service role client
 * ❌ 禁止：客户端代码 import 此模块
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * 获取 Supabase service role client（单例）
 *
 * 环境变量要求：
 * - SUPABASE_URL: Supabase 项目 URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key（绕过 RLS）
 */
export function getServiceClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * Supabase Admin Client for Edge Functions
 *
 * 使用 service_role key 创建 admin 客户端，绕过 RLS。
 * 所有 Edge Function 共享同一实例（模块顶层创建，Deno isolate 内复用）。
 * 底层走 PostgREST HTTP API，不持有 Postgres 持久连接，彻底消除连接池耗尽问题。
 *
 * 仅在 Edge Functions 中使用，客户端代码不得 import 此模块。
 */

import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

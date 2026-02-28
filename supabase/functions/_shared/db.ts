/**
 * Direct Postgres Connection for Edge Functions
 *
 * 复用现有 postgres.js 连接模式，仅改动：
 * - 环境变量 DATABASE_URL → SUPABASE_DB_URL（Supabase 自动注入）
 * - process.env → Deno.env.get()
 * - 模块顶层创建连接（Edge Runtime 在请求间复用 worker）
 *
 * Transaction mode — prepare: false（Supavisor 要求）。
 * 仅在 Edge Functions 中使用，客户端代码不得 import 此模块。
 */

import postgres from 'postgres';

const connectionString = Deno.env.get('SUPABASE_DB_URL')!;

const sql = postgres(connectionString, {
  // Edge Runtime 单连接即可（worker 复用）
  max: 1,
  idle_timeout: 60,
  connect_timeout: 10,
  // Supavisor transaction mode 需要 prepare: false
  prepare: false,
});

/** 获取 Postgres 连接 */
export function getDb() {
  return sql;
}

/**
 * 将任意 object 包装为 sql.json() 参数。
 *
 * postgres.js 的 JSONValue 类型要求 index signature，
 * 但业务 interface（如 GameState）不应添加 index signature（会削弱类型检查）。
 * 社区标准做法：将 type assertion 隔离到单一 wrapper 函数。
 */
export function jsonb(value: object): postgres.Parameter {
  return sql.json(value as postgres.JSONValue);
}

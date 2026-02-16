/**
 * Direct Postgres Connection via Supavisor
 *
 * 绕过 Supabase REST API 多层代理（CloudFlare → Kong → PostgREST），
 * 通过 Supavisor 连接池直连 Postgres，每次查询 ~5-15ms（REST 需 ~150-200ms）。
 *
 * 使用 postgres.js（轻量级，Serverless 友好，无 native 依赖）。
 * Transaction mode — 每次查询后连接自动归还连接池。
 *
 * ✅ 允许：仅在 Vercel Serverless Functions 中使用
 * ❌ 禁止：客户端代码 import 此模块
 */

import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * 将任意 object 包装为 sql.json() 参数。
 *
 * postgres.js 的 JSONValue 类型要求 index signature，
 * 但业务 interface（如 BroadcastGameState）不应添加 index signature（会削弱类型检查）。
 * 社区标准做法：将 type assertion 隔离到单一 wrapper 函数。
 *
 * @see https://github.com/porsager/postgres — sql.json() helper
 */
export function jsonb(value: object): postgres.Parameter {
  return getDb().json(value as postgres.JSONValue);
}

/**
 * 获取 Postgres 连接（单例，在同一 Serverless 实例内复用）
 *
 * 环境变量要求：
 * - DATABASE_URL: Supavisor Transaction Mode 连接串
 *   格式: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 */
export function getDb() {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL env var');
  }

  _sql = postgres(url, {
    // Serverless 优化：最少连接，配合 warm-up cron 保持连接复用
    max: 1,
    idle_timeout: 60,
    connect_timeout: 10,
    // Supavisor transaction mode 需要 prepare: false
    prepare: false,
  });

  return _sql;
}

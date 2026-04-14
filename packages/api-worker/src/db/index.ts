/**
 * Drizzle D1 driver 实例化
 *
 * 每个请求调用 `createDb(env.DB)` 获取 drizzle 实例。
 * D1 绑定生命周期与请求一致，无需单例缓存。
 */

import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

/** 创建绑定到当前请求 D1 实例的 drizzle 客户端。 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

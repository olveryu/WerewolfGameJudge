/**
 * 应用版本号配置
 *
 * 版本号基于 git commit 数量自动计算
 * 基础版本 1.000 + 每个 commit 增加 0.001
 *
 * 此文件由 scripts/update-version.sh 自动更新
 * 生成时间: 2026-01-24 10:06:08
 */

// 基于 446 个 commits 计算
export const APP_VERSION = 'v1.446';

// commit 数量
export const COMMIT_COUNT = 446;

/**
 * 获取完整版本号
 */
export function getVersionString(): string {
  return APP_VERSION;
}

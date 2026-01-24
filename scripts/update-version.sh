#!/bin/bash
# 根据 git commit 数量更新版本号
# 基础版本 1.000 + 每个 commit 增加 0.001

set -e

cd "$(dirname "$0")/.."

# 获取 commit 数量
COMMIT_COUNT=$(git rev-list --count HEAD)

# 计算版本号: 1.000 + commit_count * 0.001
# 使用 awk 进行浮点计算
VERSION=$(echo "$COMMIT_COUNT" | awk '{printf "%.3f", 1.000 + $1 * 0.001}')

echo "📦 更新版本号: v$VERSION (基于 $COMMIT_COUNT 个 commits)"

# 更新 version.ts 文件
cat > src/config/version.ts << EOF
/**
 * 应用版本号配置
 *
 * 版本号基于 git commit 数量自动计算
 * 基础版本 1.000 + 每个 commit 增加 0.001
 *
 * 此文件由 scripts/update-version.sh 自动更新
 * 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
 */

// 基于 $COMMIT_COUNT 个 commits 计算
export const APP_VERSION = 'v$VERSION';

// commit 数量
export const COMMIT_COUNT = $COMMIT_COUNT;

/**
 * 获取完整版本号
 */
export function getVersionString(): string {
  return APP_VERSION;
}
EOF

echo "✅ 版本号已更新到 src/config/version.ts"

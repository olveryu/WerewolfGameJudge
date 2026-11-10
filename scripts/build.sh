#!/bin/bash
# ============================================
# 构建脚本：构建 Web 客户端（packages/web）并产出 Pages 部署目录 dist/
# ============================================
#
# 用法：
#   bash scripts/build.sh
#
# 职责：
#   1. 编译 game-engine（Pages Functions 依赖）
#   2. pnpm --filter @game-judge/web run build（含体积预算检查）
#   3. 复制 packages/web/dist → dist/（Pages 的 pages_build_output_dir）
#   4. 上传 Sentry source maps
#
# 环境变量：
#   CF_PAGES_BRANCH   main = production，其余为预览环境名
#   WEB_ASSET_BASE    资源基址（CDN 绝对地址）；未设置时从站点根目录加载
#   VITE_SENTRY_DSN   Sentry DSN；未设置时不上报
#
# ❌ 不发布 npm CDN 包
# ❌ 不执行 Cloudflare Pages 部署
#
# ============================================

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔧 编译 game-engine..."
pnpm --filter @game-judge/game-engine run build

if [ "${CF_PAGES_BRANCH:-main}" = "main" ]; then
  export VITE_DEPLOY_ENV="production"
else
  export VITE_DEPLOY_ENV="$CF_PAGES_BRANCH"
fi
echo "🌐 Deploy env: $VITE_DEPLOY_ENV"

echo "📦 构建 Web..."
pnpm --filter @game-judge/web run build

echo "🧹 生成 dist/..."
rm -rf dist
cp -R packages/web/dist dist

if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
  VERSION="werewolfjudge@$(node -p "require('./package.json').version")"
  echo "📡 上传 source maps → Sentry release: $VERSION"
  npx sentry-cli sourcemaps inject dist/assets/
  npx sentry-cli sourcemaps upload dist/assets/ \
    --release="$VERSION" \
    --org=edwin-47 \
    --project=werewolfjudge
  # 不对外暴露 source maps
  find dist -name '*.map' -delete
  echo "✅ Source maps 已上传并清理"
else
  find dist -name '*.map' -delete
  echo "⏭️  跳过 Sentry source maps（SENTRY_AUTH_TOKEN 未设置）"
fi

echo "✅ 构建完成"

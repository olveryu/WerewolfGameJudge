#!/bin/bash
# ============================================
# 部署脚本：本地手动部署到 Vercel
# ============================================
#
# 用法：
#   bash scripts/deploy.sh
#
# 职责：
#   1. 切换 .env.local（保留 GROQ key，移走本地覆盖）
#   2. 调用 scripts/build.sh（构建 + 后处理）
#   3. vercel --prod 部署
#
# 不做（SRP）：
#   - 版本号管理 → scripts/release.sh
#   - git commit/push → scripts/release.sh
#   - 构建逻辑 → scripts/build.sh
#
# 注：git push 触发 Vercel Git Integration 时直接调用
#     scripts/build.sh，不经过此脚本。环境变量由
#     Vercel Dashboard 管理。
#
# ============================================

set -e

cd "$(dirname "$0")/.."

# ── 1. 准备构建环境 ─────────────────────────────

# .env（已提交）包含生产 Supabase 值
# .env.local（gitignored）包含本地覆盖 + GROQ key
# 构建时需要移走 .env.local 让 .env 生效，但保留 GROQ key

if [ ! -f .env ]; then
  echo "❌ 缺少 .env 文件（应已提交到 git）"
  exit 1
fi

RESTORE_ENV=false
GROQ_KEY=""

if [ -f .env.local ]; then
  GROQ_KEY=$(grep '^EXPO_PUBLIC_GROQ_API_KEY=' .env.local | cut -d '=' -f2- || true)
  mv .env.local .env.local.bak
  RESTORE_ENV=true
fi

# GROQ key 需要 bake 进 JS bundle，写入临时 .env.local
if [ -n "$GROQ_KEY" ]; then
  echo "EXPO_PUBLIC_GROQ_API_KEY=$GROQ_KEY" > .env.local
fi

# 确保退出时恢复（即使构建失败）
restore_env() {
  rm -f .env.local
  if [ "$RESTORE_ENV" = true ] && [ -f .env.local.bak ]; then
    mv .env.local.bak .env.local
    echo "♻️  已恢复 .env.local"
  fi
}
trap restore_env EXIT

# ── 2. 构建（委托 build.sh）────────────────────

bash scripts/build.sh

# 构建完成后立即恢复 env
restore_env
RESTORE_ENV=false

# ── 3. 部署 ─────────────────────────────────────

# 清理 dist/.vercel（旧的 dist-only 部署残留，现在从项目根部署）
rm -rf dist/.vercel

echo "🚀 部署到 Vercel（从项目根，包含 api/ serverless functions）..."

DEPLOYMENT_URL=$(vercel --prod --yes 2>&1 | grep -oE 'https://[^ ]+\.vercel\.app' | head -1)
echo "部署完成: $DEPLOYMENT_URL"

echo "🔗 设置别名..."
vercel alias "$DEPLOYMENT_URL" werewolf-judge.vercel.app

echo ""
echo "✅ 部署完成！"
echo "🌐 https://werewolf-judge.vercel.app"

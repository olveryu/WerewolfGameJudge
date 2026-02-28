#!/bin/bash
# ============================================
# 应急部署脚本：手动部署 Supabase Edge Functions
# ============================================
#
# 用法：
#   bash scripts/deploy.sh
#
# 职责：
#   1. 编译 game-engine ESM bundle
#   2. supabase functions deploy
#
# 日常不使用 — CI 自动部署。仅在 CI 故障时应急。
#
# ============================================

set -e

cd "$(dirname "$0")/.."

# ── 1. 编译 game-engine ESM bundle ──────────────

echo "🔧 编译 game-engine (ESM → Edge Function)..."
pnpm --filter @werewolf/game-engine run build:esm

# ── 2. 部署 Edge Functions ──────────────────────

echo ""
echo "🚀 部署 Edge Functions..."
supabase functions deploy game --project-ref abmzjezdvpzyeooqhhsn

echo ""
echo "✅ 部署完成！"
echo "📡 https://abmzjezdvpzyeooqhhsn.supabase.co/functions/v1/game"

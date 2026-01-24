#!/bin/bash
# ============================================
# 部署脚本：使用生产环境配置构建并部署到 Vercel
# ============================================
#
# 用法：
#   bash scripts/deploy.sh          # 部署到生产环境
#   bash scripts/deploy.sh --local  # 部署后恢复本地 Supabase 配置
#
# ============================================

set -e

cd "$(dirname "$0")/.."

# 解析参数
RESTORE_LOCAL=false
for arg in "$@"; do
  case $arg in
    --local)
      RESTORE_LOCAL=true
      ;;
  esac
done

echo "📦 更新版本号..."
bash ./scripts/update-version.sh

echo "📝 提交并推送更改..."
git add -A
if git diff --cached --quiet; then
  echo "没有需要提交的更改"
else
  git commit -m "chore: update version for deploy"
fi
git push origin HEAD 2>/dev/null || echo "⚠️ 推送失败（可能是网络问题），继续部署..."

echo "🔄 备份 .env.local（如果存在）..."
if [ -f .env.local ]; then
  cp .env.local .env.local.backup
  HAS_BACKUP=true
else
  HAS_BACKUP=false
fi

echo "🔧 切换到生产环境配置..."
cp .env .env.local

echo "🧹 清除缓存并构建..."
rm -rf dist
npx expo export --platform web --clear

echo "🚀 部署到 Vercel..."
cd dist
DEPLOYMENT_URL=$(vercel --prod --yes 2>&1 | grep -oE 'https://[^ ]+\.vercel\.app' | head -1)
echo "部署完成: $DEPLOYMENT_URL"

echo "🔗 设置别名..."
vercel alias "$DEPLOYMENT_URL" werewolf-judge.vercel.app

echo "♻️ 恢复开发配置..."
cd ..

# 恢复逻辑：
# 1. 如果指定 --local 且 Supabase 在运行，自动生成本地配置
# 2. 否则恢复之前的备份（如果有）
# 3. 否则删除 .env.local（使用 .env 生产配置）
if [ "$RESTORE_LOCAL" = true ]; then
  # 检查本地 Supabase 是否运行
  if supabase status --output json > /dev/null 2>&1; then
    echo "🔧 检测到本地 Supabase，自动生成 .env.local..."
    STATUS=$(supabase status --output json)
    API_URL=$(echo "$STATUS" | grep '"API_URL"' | sed 's/.*: "\(.*\)",*/\1/' | tr -d ',')
    ANON_KEY=$(echo "$STATUS" | grep '"ANON_KEY"' | sed 's/.*: "\(.*\)",*/\1/' | tr -d ',')
    cat > .env.local << EOF
EXPO_PUBLIC_SUPABASE_URL=$API_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EOF
    echo "✅ 已写入本地 Supabase 配置到 .env.local"
    rm -f .env.local.backup
  else
    echo "⚠️ 本地 Supabase 未运行，恢复备份配置..."
    if [ "$HAS_BACKUP" = true ]; then
      cp .env.local.backup .env.local
      rm .env.local.backup
    else
      rm -f .env.local
    fi
  fi
elif [ "$HAS_BACKUP" = true ]; then
  cp .env.local.backup .env.local
  rm .env.local.backup
else
  rm -f .env.local
fi

echo ""
echo "✅ 部署完成！"
echo "🌐 生产地址: https://werewolf-judge.vercel.app"
echo ""
echo "💡 切换到本地开发：bash scripts/setup-local-env.sh"

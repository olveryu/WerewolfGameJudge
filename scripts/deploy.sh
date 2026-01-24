#!/bin/bash
# 部署脚本：使用生产环境配置构建并部署到 Vercel

set -e

cd "$(dirname "$0")/.."

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

echo "♻️ 恢复本地开发配置..."
cd ..
if [ "$HAS_BACKUP" = true ]; then
  cp .env.local.backup .env.local
  rm .env.local.backup
else
  rm -f .env.local
fi

echo ""
echo "✅ 部署完成！"
echo "🌐 生产地址: https://werewolf-judge.vercel.app"

#!/bin/bash
# 部署脚本：使用生产环境配置构建并部署到 Vercel

set -e

cd "$(dirname "$0")/.."

echo "🔄 备份 .env.local..."
cp .env.local .env.local.backup

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
cp .env.local.backup .env.local
rm .env.local.backup

echo ""
echo "✅ 部署完成！"
echo "🌐 生产地址: https://werewolf-judge.vercel.app"

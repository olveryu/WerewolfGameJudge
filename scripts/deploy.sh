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
# 自动递增 patch 版本 (1.0.0 → 1.0.1)
npm version patch --no-git-tag-version

# 同步版本号到 app.json
NEW_VERSION=$(node -p "require('./package.json').version")
node -e "
const fs = require('fs');
const appJson = require('./app.json');
appJson.expo.version = '$NEW_VERSION';
fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
"
echo "✅ 版本号已同步: v$NEW_VERSION"

# 获取版本号用于 commit message
VERSION="v$NEW_VERSION"

echo "📝 提交并推送更改..."
git add -A
if git diff --cached --quiet; then
  echo "没有需要提交的更改"
else
  git commit -m "release: $VERSION"
  git tag "$VERSION"
fi

if git push origin HEAD --tags; then
  echo "✅ 推送成功"
else
  echo "⚠️ 推送失败（可能是网络问题），继续部署..."
fi

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
# 清理旧的构建产物，但保留 .vercel 配置
find dist -mindepth 1 -maxdepth 1 ! -name '.vercel' -exec rm -rf {} + 2>/dev/null || true
npx expo export --platform web --clear

echo "📱 添加 PWA 文件..."
# 复制 PWA 图标
mkdir -p dist/assets/pwa
cp assets/pwa/*.png dist/assets/pwa/
# 复制 manifest 和 service worker
cp web/manifest.json dist/
cp web/sw.js dist/

# 使用自定义 index.html 模板（保留 Expo 生成的 JS bundle）
if [ -f dist/index.html ]; then
  # 提取 Expo 生成的 JS bundle 路径
  JS_BUNDLE=$(grep -oE '/_expo/static/js/web/[^"]+\.js' dist/index.html | head -1)
  if [ -n "$JS_BUNDLE" ]; then
    # 复制模板并注入 JS bundle
    cp web/index.html dist/index.html
    # 在 </body> 前插入 script 标签
    perl -i -pe "s|</body>|    <script src=\"$JS_BUNDLE\" defer></script>\n  </body>|" dist/index.html
    echo "✅ 使用自定义 index.html 模板，JS bundle: $JS_BUNDLE"
  else
    echo "⚠️ 未找到 JS bundle，保留原 index.html"
  fi
else
  echo "⚠️ dist/index.html 不存在"
fi

echo "🚀 部署到 Vercel..."
cd dist

# 同步环境变量到 Vercel（从 .env.local.backup 读取）
echo "🔑 同步环境变量..."
if [ "$HAS_BACKUP" = true ] && [ -f ../.env.local.backup ]; then
  # 读取 EXPO_PUBLIC_GITHUB_TOKEN
  GITHUB_TOKEN=$(grep '^EXPO_PUBLIC_GITHUB_TOKEN=' ../.env.local.backup | cut -d '=' -f2)
  if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | vercel env add EXPO_PUBLIC_GITHUB_TOKEN production --force 2>/dev/null || true
    echo "✅ EXPO_PUBLIC_GITHUB_TOKEN 已同步"
  fi
fi

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

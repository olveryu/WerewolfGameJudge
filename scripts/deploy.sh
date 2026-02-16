#!/bin/bash
# ============================================
# 部署脚本：构建 Web 并部署到 Vercel
# ============================================
#
# 用法：
#   bash scripts/deploy.sh
#
# 职责：
#   1. 使用 .env（生产配置）构建
#   2. 复制 PWA / 字体 / 自定义 index.html
#   3. vercel --prod 部署
#
# 不做（SRP）：
#   - 版本号管理 → scripts/release.sh
#   - git commit/push → scripts/release.sh
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
  # 删除临时 .env.local
  rm -f .env.local
  if [ "$RESTORE_ENV" = true ] && [ -f .env.local.bak ]; then
    mv .env.local.bak .env.local
    echo "♻️  已恢复 .env.local"
  fi
}
trap restore_env EXIT

# ── 2. 构建 ─────────────────────────────────────

echo "🧹 清理 dist/..."
find dist -mindepth 1 -maxdepth 1 ! -name '.vercel' -exec rm -rf {} + 2>/dev/null || true

echo "📦 构建 Web..."
npx expo export --platform web --clear

# 构建完成后立即恢复 env（不阻塞后续步骤）
restore_env
RESTORE_ENV=false

# ── 3. 后处理（PWA / 字体 / index.html）─────────

echo "📱 复制 PWA 文件..."
mkdir -p dist/assets/pwa
cp assets/pwa/*.png dist/assets/pwa/
cp web/manifest.json dist/
cp web/sw.js dist/

# 字体路径修复：Vercel 不上传 node_modules 路径下的文件
FONT_SRC="dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
FONT_DST="dist/assets/fonts"
if [ -d "$FONT_SRC" ]; then
  echo "🔤 修复字体路径..."
  mkdir -p "$FONT_DST"
  cp "$FONT_SRC"/*.ttf "$FONT_DST/"
  OLD_PATH="/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/"
  NEW_PATH="/assets/fonts/"
  for jsfile in dist/_expo/static/js/web/*.js; do
    sed -i '' "s|$OLD_PATH|$NEW_PATH|g" "$jsfile"
  done
  FONT_COUNT=$(ls "$FONT_DST"/*.ttf 2>/dev/null | wc -l | tr -d ' ')
  echo "✅ 已复制 $FONT_COUNT 个字体文件"
  rm -rf dist/assets/node_modules
fi

# Vercel Build Output API 不提供 _expo 目录（underscore 前缀保留）
# 将 JS bundle 移到 assets/js/ 下（assets/ 已知可正常提供）
if [ -d dist/_expo/static/js/web ]; then
  mkdir -p dist/assets/js
  cp dist/_expo/static/js/web/*.js dist/assets/js/
  rm -rf dist/_expo
  echo "✅ JS bundle 移至 assets/js/（规避 Vercel _expo 限制）"
fi

# 使用自定义 index.html（保留 Expo 生成的 JS bundle）
if [ -f dist/index.html ]; then
  # 从原始 index.html 提取 bundle 文件名
  JS_FILE=$(grep -oE '/_expo/static/js/web/[^"]+\.js' dist/index.html | head -1 | sed 's|.*/_expo/static/js/web/||')
  if [ -z "$JS_FILE" ]; then
    JS_FILE=$(ls dist/assets/js/index-*.js 2>/dev/null | head -1 | xargs basename 2>/dev/null)
  fi
  if [ -n "$JS_FILE" ]; then
    cp web/index.html dist/index.html
    perl -i -pe "s|</body>|    <script src=\"/assets/js/$JS_FILE\" defer></script>\n  </body>|" dist/index.html
    echo "✅ 自定义 index.html，JS bundle: /assets/js/$JS_FILE"
  fi
fi

# JS bundle 内部引用替换 _expo → assets
for jsfile in dist/assets/js/*.js; do
  sed -i '' "s|/_expo/static/js/web/|/assets/js/|g" "$jsfile" 2>/dev/null
done

# Service Worker 缓存版本号（使用构建时间戳自动递增）
SW_VERSION="werewolf-judge-$(date +%Y%m%d%H%M%S)"
if [ -f dist/sw.js ]; then
  sed -i '' "s|__SW_CACHE_VERSION__|$SW_VERSION|g" dist/sw.js
  echo "✅ SW 缓存版本: $SW_VERSION"
fi

# ── 4. 部署 ─────────────────────────────────────

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

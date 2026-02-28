#!/bin/bash
# ============================================
# 构建脚本：导出 Web 并执行后处理
# ============================================
#
# 用法：
#   bash scripts/build.sh
#
# 职责：
#   1. 编译 game-engine（Serverless Functions 依赖）
#   2. npx expo export --platform web
#   3. 后处理：PWA / 字体 / _expo→assets/js / 自定义 index.html / SW 版本
#
# 调用方：
#   - Vercel buildCommand（Git Integration 自动部署）
#   - scripts/deploy.sh（本地手动部署）
#
# ✅ 跨平台兼容（macOS + Linux），用 perl 替代 sed -i
# ❌ 不处理环境变量（Vercel Dashboard 或 deploy.sh 负责）
# ❌ 不执行部署（Vercel 自动部署或 deploy.sh 负责）
#
# ============================================

set -e

cd "$(dirname "$0")/.."

# ── 1. 编译 game-engine ─────────────────────────

echo "🔧 编译 game-engine (CJS)..."
(cd packages/game-engine && npx tsc -p tsconfig.build.json)

echo "🔧 编译 game-engine (ESM → Edge Function)..."
(cd packages/game-engine && npx esbuild src/index.ts --bundle --format=esm \
  --outfile=../../supabase/functions/_shared/game-engine/index.js)

# ── 2. 构建 Web ─────────────────────────────────

echo "🧹 清理 dist/..."
mkdir -p dist
find dist -mindepth 1 -maxdepth 1 ! -name '.vercel' -exec rm -rf {} + 2>/dev/null || true

# Expose Vercel deploy environment to Expo (EXPO_PUBLIC_* prefix required for Metro inlining)
export EXPO_PUBLIC_DEPLOY_ENV="${VERCEL_ENV:-production}"
echo "🌐 Deploy env: $EXPO_PUBLIC_DEPLOY_ENV"

echo "📦 构建 Web..."
npx expo export --platform web --clear

# ── 3. 后处理（PWA / 字体 / index.html）─────────

echo "📱 复制 PWA 文件..."
mkdir -p dist/assets/pwa
cp assets/pwa/*.png dist/assets/pwa/
cp web/manifest.json dist/
cp web/sw.js dist/

# 字体路径修复：Expo 将字体放在 node_modules/ 路径下，Vercel 不提供该路径
FONT_SRC="dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
FONT_DST="dist/assets/fonts"
if [ -d "$FONT_SRC" ]; then
  echo "🔤 修复字体路径..."
  mkdir -p "$FONT_DST"
  cp "$FONT_SRC"/*.ttf "$FONT_DST/"
  for jsfile in dist/_expo/static/js/web/*.js; do
    perl -i -pe 's|/assets/node_modules/\@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/|/assets/fonts/|g' "$jsfile"
  done
  FONT_COUNT=$(ls "$FONT_DST"/*.ttf 2>/dev/null | wc -l | tr -d ' ')
  echo "✅ 已复制 $FONT_COUNT 个字体文件"
  rm -rf dist/assets/node_modules
fi

# Vercel _expo 目录限制（underscore 前缀保留）：将 JS bundle 移到 assets/js/
if [ -d dist/_expo/static/js/web ]; then
  mkdir -p dist/assets/js
  cp dist/_expo/static/js/web/*.js dist/assets/js/
  rm -rf dist/_expo
  echo "✅ JS bundle 移至 assets/js/（规避 Vercel _expo 限制）"
fi

# 使用自定义 index.html（保留 Expo 生成的 JS bundle 引用）
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
  perl -i -pe 's|/_expo/static/js/web/|/assets/js/|g' "$jsfile" 2>/dev/null
done

# Service Worker 缓存版本号（使用构建时间戳自动递增）
SW_VERSION="werewolf-judge-$(date +%Y%m%d%H%M%S)"
if [ -f dist/sw.js ]; then
  perl -i -pe "s|__SW_CACHE_VERSION__|$SW_VERSION|g" dist/sw.js
  echo "✅ SW 缓存版本: $SW_VERSION"
fi

echo "✅ 构建完成"

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
#   - Cloudflare Pages Build（Git Integration 自动部署）
#   - scripts/deploy.sh（本地手动部署）
#
# ✅ 跨平台兼容（macOS + Linux），用 perl 替代 sed -i
# ❌ 不处理环境变量（Cloudflare Pages Dashboard 负责）
# ❌ 不执行部署（Cloudflare Pages 自动部署）
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
find dist -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true

# Expose deploy environment to Expo (EXPO_PUBLIC_* prefix required for Metro inlining)
# CF_PAGES_BRANCH is set by Cloudflare Pages ("main" = production, others = preview)
if [ "$CF_PAGES_BRANCH" = "main" ]; then
  export EXPO_PUBLIC_DEPLOY_ENV="production"
else
  export EXPO_PUBLIC_DEPLOY_ENV="${CF_PAGES_BRANCH:-production}"
fi
echo "🌐 Deploy env: $EXPO_PUBLIC_DEPLOY_ENV"

echo "📦 构建 Web..."
npx expo export --platform web --clear

# ── 3. 后处理（PWA / 字体 / index.html）─────────

echo "📱 复制 PWA 文件..."
mkdir -p dist/assets/pwa
cp assets/pwa/*.png dist/assets/pwa/
cp web/manifest.json dist/
cp web/sw.js dist/

# 字体路径修复：Expo 将字体放在 node_modules/ 路径下，部署平台不提供该路径
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

# _expo 目录重命名：将 JS bundle 移到 assets/js/（Cloudflare Pages 不保留 underscore 前缀）
if [ -d dist/_expo/static/js/web ]; then
  mkdir -p dist/assets/js
  cp dist/_expo/static/js/web/*.js dist/assets/js/
  rm -rf dist/_expo
  echo "✅ JS bundle 移至 assets/js/"
fi

# 使用自定义 index.html（保留 Expo 生成的所有 JS bundle 引用）
if [ -f dist/index.html ]; then
  # 从原始 index.html 提取所有 bundle 引用（保持 Expo 输出顺序：runtime → common → index）
  SCRIPT_TAGS=""
  JS_ASSET_LIST=""
  JS_COUNT=0
  while IFS= read -r jsref; do
    fname=$(echo "$jsref" | sed 's|.*/_expo/static/js/web/||')
    SCRIPT_TAGS="${SCRIPT_TAGS}    <script src=\"/assets/js/${fname}\" defer></script>\n"
    [ -n "$JS_ASSET_LIST" ] && JS_ASSET_LIST="$JS_ASSET_LIST,"
    JS_ASSET_LIST="$JS_ASSET_LIST'/assets/js/$fname'"
    JS_COUNT=$((JS_COUNT + 1))
  done < <(grep -oE '/_expo/static/js/web/[^"]+\.js' dist/index.html)

  # fallback：如果 Expo HTML 中没有引用（不应发生），尝试从文件系统获取
  if [ "$JS_COUNT" -eq 0 ]; then
    for jsfile in dist/assets/js/index-*.js; do
      fname=$(basename "$jsfile")
      SCRIPT_TAGS="    <script src=\"/assets/js/${fname}\" defer></script>\n"
      JS_ASSET_LIST="'/assets/js/$fname'"
      JS_COUNT=1
      break
    done
  fi

  if [ "$JS_COUNT" -gt 0 ]; then
    cp web/index.html dist/index.html
    perl -i -pe "s|</body>|${SCRIPT_TAGS}  </body>|" dist/index.html
    echo "✅ 自定义 index.html，注入 ${JS_COUNT} 个 JS bundle"
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
  # 注入 JS entry bundle 列表（确保 SW 更新时新 bundle 已预缓存，避免白屏）
  perl -i -pe "s|/\\* __JS_ASSETS__ \\*/|$JS_ASSET_LIST|g" dist/sw.js
  echo "✅ SW 缓存版本: $SW_VERSION（含 ${JS_COUNT} 个 JS bundle 预缓存）"
fi

# 复制 Cloudflare Pages 配置文件
cp web/_headers dist/
cp web/_redirects dist/
cp web/_routes.json dist/
echo "✅ 已复制 _headers + _redirects + _routes.json"

echo "✅ 构建完成"

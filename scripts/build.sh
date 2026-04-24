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
npx expo export --platform web --clear --source-maps

# ── 3. 后处理（PWA / 字体 / index.html）─────────

echo "📱 复制 PWA 文件..."
mkdir -p dist/assets/pwa
cp assets/pwa/*.png dist/assets/pwa/
cp web/manifest.json dist/

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
  cp dist/_expo/static/js/web/*.js.map dist/assets/js/ 2>/dev/null || true
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

  # CDN rewrite：CI 设置 CDN_BASE_URL 时，把所有 /assets/ 引用改为 CDN 绝对 URL
  # 例如 CDN_BASE_URL=https://cdn.werewolfjudge.eu.org
  # /assets/js/xxx.js → https://cdn.werewolfjudge.eu.org/assets/js/xxx.js
  # /assets/assets/audio/xxx.mp3 → https://cdn.werewolfjudge.eu.org/assets/assets/audio/xxx.mp3
  if [ -n "$CDN_BASE_URL" ]; then
    # HTML: rewrite src="/assets/... and href="/assets/... to CDN
    perl -i -pe "s|src=\"/assets/|src=\"${CDN_BASE_URL}/assets/|g" dist/index.html
    perl -i -pe "s|href=\"/assets/|href=\"${CDN_BASE_URL}/assets/|g" dist/index.html

    # JS bundles: rewrite "/assets/ string literals (Metro asset references)
    for jsfile in dist/assets/js/*.js; do
      perl -i -pe "s|\"/assets/|\"${CDN_BASE_URL}/assets/|g" "$jsfile"
    done

    echo "✅ 所有资源路径已改写为 CDN: ${CDN_BASE_URL}/assets/"
  fi
fi

# JS bundle 内部引用替换 _expo → assets
for jsfile in dist/assets/js/*.js; do
  perl -i -pe 's|/_expo/static/js/web/|/assets/js/|g' "$jsfile" 2>/dev/null
done

# 复制 Cloudflare Pages 配置文件
cp web/_headers dist/
cp web/_redirects dist/
cp web/_routes.json dist/
cp web/sw.js dist/
echo "✅ 已复制 _headers + _redirects + _routes.json + sw.js"

# ── 4. Sentry Source Maps ───────────────────────

if [ -n "$SENTRY_AUTH_TOKEN" ]; then
  VERSION="werewolfjudge@v$(node -p "require('./package.json').version")"
  echo "📡 上传 source maps → Sentry release: $VERSION"
  npx sentry-cli sourcemaps inject dist/assets/js/
  npx sentry-cli sourcemaps upload dist/assets/js/ \
    --release="$VERSION" \
    --org=edwin-47 \
    --project=werewolfjudge
  # 不对外暴露 source maps
  rm -f dist/assets/js/*.map
  echo "✅ Source maps 已上传并清理"
else
  echo "⏭️  跳过 Sentry source maps（SENTRY_AUTH_TOKEN 未设置）"
fi

echo "✅ 构建完成"

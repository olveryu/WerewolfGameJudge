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
# 注入 PWA meta 标签和 loading 样式到 index.html
if [ -f dist/index.html ]; then
  # 1. 注入 body 背景色和 loading 动画样式（在 </style> 后面）
  perl -i -pe 's|</style>|</style>\n    <style id="loading-style">\n      body { background-color: #1a1a2e; }\n      #loading-splash { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #1a1a2e; display: flex; align-items: center; justify-content: center; z-index: 9999; }\n      #loading-splash img { width: 120px; height: 120px; animation: pulse 1.5s ease-in-out infinite; }\n      \@keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1); } }\n    </style>|' dist/index.html
  # 2. 注入 PWA meta 标签
  perl -i -pe 's|</head>|    <meta name="theme-color" content="#1a1a2e" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="apple-mobile-web-app-title" content="狼人杀电子法官" />\n    <link rel="apple-touch-icon" href="/assets/pwa/apple-touch-icon.png" />\n    <link rel="manifest" href="/manifest.json" />\n  </head>|' dist/index.html
  # 3. 在 #root 前插入 loading splash
  perl -i -pe 's|<div id="root"></div>|<div id="loading-splash"><img src="/assets/pwa/icon-192.png" alt="Loading..." /></div>\n    <div id="root"></div>\n    <script>window.addEventListener("load", function() { var s = document.getElementById("loading-splash"); if(s) s.style.display = "none"; });</script>|' dist/index.html
  echo "✅ PWA meta 标签和 loading 动画已注入"
else
  echo "⚠️ dist/index.html 不存在，跳过 PWA 注入"
fi

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

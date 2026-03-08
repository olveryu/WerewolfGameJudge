#!/bin/bash
# ============================================
# 从本地 Supabase 获取环境变量并写入 .env.local
# ============================================
#
# 用法：
#   bash scripts/setup-local-env.sh          # 自动获取本地 Supabase 配置
#   bash scripts/setup-local-env.sh --start  # 如果 Supabase 没运行，先启动它
#
# ============================================

set -e

cd "$(dirname "$0")/.."

# 解析参数
AUTO_START=false
for arg in "$@"; do
  case $arg in
    --start)
      AUTO_START=true
      ;;
  esac
done

echo "🔍 检查 Supabase 状态..."

# 检查 supabase 是否运行
if ! supabase status --output json > /dev/null 2>&1; then
  if [ "$AUTO_START" = true ]; then
    echo "🚀 Supabase 未运行，正在启动..."
    supabase start
  else
    echo "❌ Supabase 未运行"
    echo ""
    echo "💡 使用以下命令启动："
    echo "   supabase start"
    echo ""
    echo "   或使用 --start 参数自动启动："
    echo "   bash scripts/setup-local-env.sh --start"
    exit 1
  fi
fi

# 获取 JSON 状态
STATUS=$(supabase status --output json)

# 解析需要的值
API_URL=$(echo "$STATUS" | grep '"API_URL"' | sed 's/.*: "\(.*\)",*/\1/' | tr -d ',')
ANON_KEY=$(echo "$STATUS" | grep '"ANON_KEY"' | sed 's/.*: "\(.*\)",*/\1/' | tr -d ',')

echo "📡 API_URL: $API_URL"
echo "🔑 ANON_KEY: ${ANON_KEY:0:20}..."

# 保留已有的非 Supabase 变量（如 GEMINI_API_KEY）
EXISTING=""
if [ -f .env.local ]; then
  EXISTING=$(grep -v '^EXPO_PUBLIC_SUPABASE_' .env.local | grep -v '^#' | grep -v '^$' || true)
fi

# 写入 .env.local（Supabase 覆盖 + 保留其他变量）
cat > .env.local << EOF
EXPO_PUBLIC_SUPABASE_URL=$API_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EOF

# 追加保留的变量
if [ -n "$EXISTING" ]; then
  echo "$EXISTING" >> .env.local
fi

echo ""
echo "✅ 已写入 .env.local"
if [ -n "$EXISTING" ]; then
  echo "♻️  已保留其他变量（如 GEMINI_API_KEY）"
fi
echo ""
echo "💡 重启 Metro bundler 以应用更改 (Ctrl+C 后 npm start)"

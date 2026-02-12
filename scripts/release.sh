#!/bin/bash
# ============================================
# 发版脚本：版本号 + commit + tag + push
# ============================================
#
# 用法：
#   bash scripts/release.sh          # patch (1.0.0 → 1.0.1)
#   bash scripts/release.sh minor    # minor (1.0.1 → 1.1.0)
#   bash scripts/release.sh major    # major (1.1.0 → 2.0.0)
#
# ============================================

set -e

cd "$(dirname "$0")/.."

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "❌ 无效版本类型: $BUMP_TYPE"
  echo "   用法: bash scripts/release.sh [patch|minor|major]"
  exit 1
fi

echo "📦 Bumping $BUMP_TYPE version..."
npm version "$BUMP_TYPE" --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")

# 同步版本号到 app.json
node -e "
const fs = require('fs');
const appJson = require('./app.json');
appJson.expo.version = '$VERSION';
fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
"
echo "✅ Version: v$VERSION"

echo "📝 Committing..."
git add -A

# 如果除了版本文件外还有其他改动，提示用户先单独 commit
OTHER_CHANGES=$(git diff --cached --name-only | grep -v -E '^(package\.json|package-lock\.json|app\.json|src/config/version\.ts)$' | head -5)
if [ -n "$OTHER_CHANGES" ]; then
  echo ""
  echo "⚠️  检测到版本文件之外的改动："
  echo "$OTHER_CHANGES"
  echo ""
  read -p "是否一起提交？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消。请先 commit 其他改动，再运行 release。"
    git reset HEAD > /dev/null
    exit 1
  fi
fi

git commit -m "release: v$VERSION"
git tag "v$VERSION"

echo "🚀 Pushing..."
if git push origin HEAD --tags; then
  echo "✅ Released v$VERSION"
else
  echo "⚠️  Push 失败（可能是网络问题），本地 tag 已创建。"
  echo "   稍后手动: git push origin HEAD --tags"
fi

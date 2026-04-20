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

# 先检查是否有未提交的非版本文件改动（在 bump 之前，避免取消时版本号已变）
OTHER_CHANGES=$(git diff --name-only HEAD | grep -v -E '^(package\.json|pnpm-lock\.yaml|app\.json|src/config/version\.ts)$' | head -5)
STAGED_OTHER=$(git diff --cached --name-only | grep -v -E '^(package\.json|pnpm-lock\.yaml|app\.json|src/config/version\.ts)$' | head -5)
ALL_OTHER="${OTHER_CHANGES}${STAGED_OTHER}"
if [ -n "$ALL_OTHER" ]; then
  echo ""
  echo "⚠️  检测到版本文件之外的未提交改动："
  echo "$ALL_OTHER"
  echo ""
  read -p "是否一起提交？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消。请先 commit 其他改动，再运行 release。"
    exit 1
  fi
fi

echo "📦 Bumping $BUMP_TYPE version..."
pnpm version "$BUMP_TYPE" --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")

# 同步版本号到 app.json
node -e "
const fs = require('fs');
const appJson = require('./app.json');
appJson.expo.version = '$VERSION';
fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2) + '\n');
"
echo "✅ Version: v$VERSION"

# ── 检查 announcements 是否有当前版本条目 ──
if ! grep -q "'v$VERSION'" src/config/announcements.ts; then
  echo ""
  echo "⚠️  src/config/announcements.ts 缺少 v$VERSION 条目"
  echo "   请先添加 What's New 内容，再重新运行 release。"
  echo ""
  exit 1
fi

# ── 自动更新 CHANGELOG.md ──
PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")
TODAY=$(date +%Y-%m-%d)

if [ -n "$PREV_TAG" ]; then
  # 收集自上个 tag 以来的非 release commit
  CHANGES=$(git log --format='- %s' "$PREV_TAG..HEAD" | grep -v '^- release:')
else
  CHANGES="- Initial release"
fi

if [ -n "$CHANGES" ]; then
  HEADER="## [$VERSION] - $TODAY"
  # 在 CHANGELOG.md 的第一个 "## " 之前插入新条目
  if [ -f CHANGELOG.md ] && grep -q '^## ' CHANGELOG.md; then
    # 用 node 做文本插入（避免 sed 跨平台差异）
    node -e "
const fs = require('fs');
const cl = fs.readFileSync('CHANGELOG.md', 'utf8');
const entry = '$HEADER\n\n' + $(echo "$CHANGES" | node -e "
  const lines = require('fs').readFileSync('/dev/stdin','utf8').trim();
  process.stdout.write(JSON.stringify(lines));
") + '\n\n';
const idx = cl.indexOf('\n## ');
const updated = cl.slice(0, idx + 1) + entry + cl.slice(idx + 1);
fs.writeFileSync('CHANGELOG.md', updated);
"
    echo "📋 CHANGELOG.md updated"
  fi
fi

echo "📝 Committing..."
git add -A

git commit -m "release: v$VERSION"
git tag "v$VERSION"

echo "🚀 Pushing..."
if git push origin HEAD --tags; then
  echo "✅ Released v$VERSION"
else
  echo "⚠️  Push 失败（可能是网络问题），本地 tag 已创建。"
  echo "   稍后手动: git push origin HEAD --tags"
fi

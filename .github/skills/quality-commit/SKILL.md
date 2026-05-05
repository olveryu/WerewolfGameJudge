---
name: quality-commit
description: 'Run full quality pipeline, auto-fix lint/format issues, then commit and push. Use when: quality fix commit push, run quality, fix lint, fix format, 跑质量检查, 修 lint, 修格式, 提交推送, quality commit push.'
argument-hint: 'commit message（可选，不填则自动生成）'
---

# quality-commit Skill

运行完整质量管道 → 自动修复可修复问题 → commit → push，全程零手动。

## When to Use

- 用户要求跑 quality / fix / commit / push 的任意组合
- 用户想一键交付当前改动
- 用户说"帮我 quality fix 然后提交"

---

## Procedure

### Phase 1 — 运行质量检查

```bash
pnpm run quality
```

记录输出。如果全部通过 → 跳到 Phase 3。

### Phase 2 — 自动修复（按失败类型逐步处理）

**只做自动可修复的事情；无法自动修复的 bug 必须停下报告。**

#### 2a. Lint / Format 错误

```bash
# 先跑 lint --fix，再跑 prettier
pnpm exec eslint . --fix
pnpm exec prettier --write .
```

修复后**重跑** `pnpm run quality`，确认通过。

若 lint 报告的错误不是 auto-fixable（如 `no-explicit-any`、逻辑错误）：

```
STATUS: BLOCKED
REASON: lint 存在无法自动修复的错误：<列出每条>
ATTEMPTED: eslint --fix + prettier --write
RECOMMENDATION: 手动修复上述错误后重新执行 skill
```

#### 2b. TypeScript 类型错误

TypeScript 错误**不能自动修复**，立即报告：

```
STATUS: BLOCKED
REASON: TypeScript 类型错误：<列出每条>
ATTEMPTED: pnpm run quality
RECOMMENDATION: 手动修复类型错误后重新执行 skill
```

#### 2c. 测试失败

测试失败**不能自动修复**，立即报告：

```
STATUS: BLOCKED
REASON: 测试失败：<列出失败的测试名>
ATTEMPTED: pnpm run quality
RECOMMENDATION: 手动修复测试后重新执行 skill
```

#### 2d. knip 死代码警告

knip 误报（`metro.config.js`, `react-dom` 等）忽略。真正的死代码报告给用户决策，不自动删除。

---

### Phase 3 — 生成 commit message

1. 用 `get_changed_files` 或 `git diff --cached --stat` 获取变更文件列表。
2. 根据变更内容生成 **Conventional Commits** 格式 message：
   - `<type>(<scope>): <description>`（英文小写祈使语气）
   - type：`feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `style` / `perf`
   - scope：取主要变更目录/模块名（如 `roomscreen`、`api-worker`、`game-engine`）
   - description：具体说明做了什么，不用模糊词

3. 如果用户已在 argument 里提供了 commit message → 直接用用户提供的，不覆盖。

4. **展示给用户确认**（除非用户说"不用确认直接提交"）：

```
准备提交：
  <commit message>

变更文件：
  <文件列表>

确认提交？(yes/修改 message)
```

---

### Phase 4 — Commit & Push

用户确认后：

```bash
git add -A
git commit -m "<commit message>"
git push
```

检查 push 输出，确认成功。如果 push 被拒（non-fast-forward），报告给用户：

```
STATUS: BLOCKED
REASON: git push 被拒，远端有新提交需要先 pull/rebase
ATTEMPTED: git push
RECOMMENDATION: git pull --rebase 后重新执行 skill
```

---

## 约束

- **禁止 `--no-verify`。** 不绕过 git hooks。
- **禁止强制推送。** 不用 `--force` / `--force-with-lease`。
- **禁止自动修复逻辑错误。** 仅 lint/format 可自动修复，其余停下报告。
- **禁止删除文件。** knip 死代码警告只报告，不自动删除。

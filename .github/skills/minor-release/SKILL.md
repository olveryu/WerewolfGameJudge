---
name: minor-release
description: 'Execute a minor release end-to-end: collect changes, write announcement, bump version, commit, tag, push. Use when: minor-release, 发版, minor release, 发 minor, 新版本, release minor.'
argument-hint: '主要变更描述（可选，用于生成 announcement）'
---

# minor-release Skill

端到端执行 minor release：收集变更 → 编写 announcement → quality 检查 → bump + commit + tag + push。

## When to Use

- 用户要求发一个 minor 版本
- 用户说"发版"、"新版本"、"release"
- 开发周期结束，需要把积累的变更打包发布

---

## Procedure

### Phase 1 — 收集变更信息

1. 获取当前版本号：

   ```bash
   node -p "require('./package.json').version"
   ```

2. 获取上一个 tag 以来的所有 commit：

   ```bash
   git log --oneline "$(git describe --tags --abbrev=0 HEAD)..HEAD"
   ```

3. 按 Conventional Commits type 分类（feat / fix / refactor / perf / chore / ci / docs / test / style）。

4. 过滤出**用户可感知**的变更（保留 feat / fix / perf / refactor 中影响 UI 或行为的）。去掉纯 chore / ci / docs / test / style。

5. 向用户展示变更摘要，询问：
   - 是否有额外想强调的功能点？
   - 是否需要调整措辞或排序？
   - 是否有变更不应出现在公告中？

---

### Phase 2 — 编写 Announcement + 等待确认

1. 计算新版本号（当前 minor bump，如 `2.3.0` → `2.4.0`）。

2. 在 `src/config/announcements.ts` 的 `ANNOUNCEMENTS` 对象**顶部**（第一个属性位置）新增条目：

   ```typescript
   'v{x.y.z}': {
     title: 'v{x.y.z} 更新内容',
     items: [
       '面向用户的中文描述，每条 ≤30 字',
       // ...
     ],
   },
   ```

3. **items 编写规范**：
   - 一律中文，面向终端用户
   - 每条 ≤30 字，不含技术实现细节（不提"重构"、"架构"、"中间件"等）
   - 只写用户能感知到的变化：新功能、体验优化、重要 bug 修复
   - 新功能在前，优化在中，修复在后
   - 通常 3-6 条

4. **输出草稿，展示给用户，等待确认后再继续。**

---

### Phase 3 — 执行 Release

#### 3a. 提交 announcement 改动

如果 `src/config/announcements.ts` 有未提交的改动，先独立提交：

```bash
git add src/config/announcements.ts
git commit -m "docs(announcements): add v{x.y.z} What's New entry"
```

#### 3b. 运行质量检查

```bash
pnpm run quality
```

如果失败：

- **lint / format 错误** → `pnpm exec eslint . --fix && pnpm exec prettier --write .`，修完重跑
- **TypeScript 类型错误** → 尝试修复；无法安全修复则 BLOCKED
- **测试失败** → 立即 BLOCKED，不自动修改业务逻辑

#### 3c. 执行 release 脚本

```bash
bash scripts/release.sh minor
```

脚本会自动：

- bump `package.json` + 同步 `app.json`
- 检查 `announcements.ts` 是否有对应版本条目（Phase 2 已添加）
- 生成 CHANGELOG 条目
- `git add -A && git commit -m "release: v{x.y.z}"`
- 创建 git tag `v{x.y.z}`
- push to origin

#### 3d. 处理脚本交互

- 如果脚本提示"检测到版本文件之外的未提交改动"并询问是否一起提交 → 输入 `y`（因为 announcement 已在 3a 提交，此处不应触发；如触发说明有其他改动，需评估）
- 如果脚本报 announcements 缺条目 → 说明 Phase 2 的提交未生效，回到 Phase 2 检查

---

### Phase 4 — 验证

1. 确认 release commit 和 tag：

   ```bash
   git log --oneline -3
   ```

2. 确认 tag 存在：

   ```bash
   git tag -l 'v*' | tail -3
   ```

3. 确认远程 push 成功（检查 Phase 3 输出中的 `✅ Released v{x.y.z}`）。

4. 如果 push 失败（网络问题），提示用户：

   ```bash
   git push origin HEAD --tags
   ```

---

## 错误处理

| 场景                               | 处理                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `pnpm run quality` 失败            | 尝试 auto-fix（lint/format）；类型错误/测试失败 → BLOCKED   |
| release.sh 报 announcements 缺条目 | 回到 Phase 2，确认条目已正确添加并 commit                   |
| release.sh 报 working tree 不干净  | 评估未提交改动，必要时先 commit 或 stash                    |
| push 失败                          | 本地 tag 已创建，提示用户手动 `git push origin HEAD --tags` |
| 版本号计算错误                     | 以 `package.json` 中的值为准，用 `node -p` 验证             |

---

## 约束

- **announcement items 一律中文**，不含技术实现细节
- **不修改 `release.sh` 本身**
- **release commit 由脚本生成**（`release: v$VERSION`），不手动 commit 版本文件
- **announcement 改动用独立 commit** `docs(announcements): add v$VERSION What's New entry`
- **禁止 `--no-verify`**，不绕过 git hooks
- **禁止强制推送**
- **不改业务逻辑** — 本 skill 只处理发版流程
- **E2E 兼容** — announcement title 必须匹配 `/^v\d+\.\d+\.\d+ 更新内容$/` 格式（E2E auto-dismisser 依赖此正则）

---
name: new-e2e-spec
description: 'Add a new Playwright E2E spec for a night role, flow, or feature. Use when: adding an e2e test, new playwright spec, 新增E2E测试, 添加E2E.'
argument-hint: '测试目标描述（如：守卫保护目标不死、6人局魔术师换位）'
---

# 新增 E2E Spec Skill

端到端添加一个 Playwright E2E 测试，从确定测试目标到本地通过。

## When to Use

- 用户要求新增/添加 E2E 测试
- 用户描述了一个需要验证的游戏流程场景

## Architecture Overview

```
e2e/
├── fixtures/app.fixture.ts    ← test.extend + createPlayerContexts + closeAll
├── pages/                     ← Page Objects (class-based)
│   ├── HomePage.ts
│   ├── RoomPage.ts
│   ├── ConfigPage.ts
│   ├── NightFlowPage.ts
│   └── BoardPickerPage.ts
├── helpers/
│   ├── night-setup.ts         ← withSetup() harness (creates game, runs body, cleans up)
│   ├── night-driver.ts        ← Role-aware night actions (click seat, wolf vote, reveals)
│   ├── multi-player.ts        ← setupNPlayerGame / setupNPlayerGameWithRoles
│   ├── waits.ts               ← ensureConnected, waitForRoomScreenReady
│   ├── home.ts                ← ensureAnonLogin, registerAutoDismissers
│   ├── ui.ts                  ← gotoWithRetry, clickIfVisible, screenshotOnFail
│   └── diagnostics.ts         ← DiagnosticData logger per player
└── specs/                     ← Test files (grouped by topic)
```

## Procedure

### Phase 1 — 确定测试目标

1. 从用户输入提取测试场景。
2. 确定以下信息：

| 字段        | 说明                        | 示例                      |
| ----------- | --------------------------- | ------------------------- |
| 测试类别    | night-role / flow / feature | night-role                |
| 涉及角色    | 哪些角色参与                | seer, wolf, villager      |
| 玩家数      | 最少几人能覆盖场景          | 3                         |
| 预期结果    | 断言什么                    | reveal 显示 "好人"        |
| spec 文件名 | 放入哪个文件或新建          | night-roles-check.spec.ts |

3. 查看现有 specs 是否已有相似测试（避免重复）。

### Phase 2 — 选择测试模式

**Night-role 测试（最常见）**：使用 `withSetup` + `night-driver`。

```typescript
import { expect, test } from '@playwright/test';
import { /* helpers */ } from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

test('描述', async ({ browser }) => {
  await withSetup(
    browser,
    {
      playerCount: N,
      configure: async (c) => c.configureCustomTemplate({ wolves: M, gods: [...], villagers: K }),
    },
    async ({ pages, roleMap }) => {
      // Drive night actions + assert results
    },
  );
});
```

**Non-night 测试（room lifecycle, config, etc.）**：使用 `app` fixture。

```typescript
import { test } from '../fixtures/app.fixture';

test('描述', async ({ app: { page, diag } }) => {
  // Already logged in and on home screen
});
```

### Phase 3 — 实现

#### 关键规则（参见 tests.instructions.md）

- **禁止** `page.waitForTimeout(N)`（唯一例外：轮询循环内 ≤300ms）
- **禁止** `.isVisible({ timeout: N })`（Playwright 忽略此参数）
- **禁止** `console.log`（用 `test.step()` + `testInfo.attach()`）
- 每个 spec 创建独立房间（test isolation）
- 超时设置：night 测试推荐 `test.setTimeout(180_000)`
- 用 `ensureConnected(page)` 确保 WebSocket 连接稳定
- 用 `waitForRoomScreenReady(page)` 等待房间加载完成

#### night-driver 常用 helpers

| Helper                                      | 用途                  |
| ------------------------------------------- | --------------------- |
| `findRolePageIndex(map, name)`              | 按角色名找 page index |
| `findAllRolePageIndices(map, name)`         | 找某角色所有 pages    |
| `waitForRoleTurn(page, keywords, allPages)` | 等待该角色行动轮      |
| `clickSeatAndConfirm(page, seat)`           | 点击座位 + 确认       |
| `driveWolfVote(pages, wolfIndices, seat)`   | 狼人投票              |
| `waitForNightEnd(pages)`                    | 等待天亮              |
| `readAlertText(page)`                       | 读取弹窗文本          |
| `dismissAlert(page)`                        | 关闭弹窗              |
| `viewLastNightInfo(page)`                   | 查看昨夜信息          |
| `clickBottomButton(page, text)`             | 点底部按钮            |

#### ⚠️ 夜间步骤顺序（NIGHT_STEPS）

**必须按 `packages/game-engine/src/models/roles/spec/plan.ts` 中 NIGHT_STEPS 的顺序驱动角色。**
`waitForRoleTurn` 会 `tryClickAdvanceButton(includeSkip=true)` 推进 OTHER 页面，如果顺序错误会导致目标角色被自动跳过。

查看顺序：`grep -n '' packages/game-engine/src/models/roles/spec/plan.ts`

常见顺序参考（position）：

- `crowCurse` (15) → `wolfKill` (16) → `hiddenWolfReveal` (18) → `seerCheck` (24)
- `guardProtect` (14) → `wolfKill` (16) → `witchSave/witchPoison` (20/21)

#### ⚠️ actionKind 驱动模式（关键！）

不同 `actionKind` 的步骤在 UI 上有不同流程。必须按对应模式驱动：

**`chooseSeat` 步骤**（seer、crow、wolf 等选目标）：

```typescript
// 1. waitForRoleTurn 检测到关键词
const turn = await waitForRoleTurn(page, ['查验', '选择'], allPages, 120);
// 2. clickSeatAndConfirm 内部会 dismissAlert 再点座位
await clickSeatAndConfirm(page, targetSeat);
// 3. 读取结果弹窗（如有）
const reveal = await readAlertText(page);
await dismissAlert(page);
```

参考：`night-roles-check.spec.ts`

**`chooseSeat` + skip（不用技能）**：

```typescript
const turn = await waitForRoleTurn(page, ['诅咒', '选择'], allPages, 120);
// 必须先 dismiss 初始 prompt alert！
await dismissAlert(page);
await clickBottomButton(page, '不用技能');
// 有些角色 skip 后会弹确认
await dismissAlert(page);
```

参考：`night-roles-block.spec.ts` seer/guard skip 测试

**`confirm` 步骤**（hiddenWolf 查看同伴、avenger 查看阵营等）：

```typescript
const turn = await waitForRoleTurn(page, ['查看', '同伴'], allPages, 120);
// 1. dismiss 初始 prompt alert（promptExecutor 的 showRoleActionPrompt）
await dismissAlert(page);
// 2. 点底部按钮触发实际动作
await clickBottomButton(page, '查看同伴');
// 3. 读取结果弹窗
const reveal = await readAlertText(page);
await dismissAlert(page);
```

参考：`night-roles-hidden-wolf-crow.spec.ts`、`night-roles-kill.spec.ts` (avenger)

**wolf kill**（专用 helper）：

```typescript
const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], allPages, 120);
await driveWolfVote(pages, wolfIndices, targetSeat);
```

#### ConfigPage 模板配置

```typescript
configure: async (c) =>
  c.configureCustomTemplate({
    wolves: 1,
    goodRoles: ['seer', 'witch'],
    villagers: 2,
    // wolfRoles: ['hiddenWolf']      // 狼阵营特殊角色
    // specialRoles: ['thief']        // 第三方角色
  });
```

### Phase 3.5 — 核心原则自检

对本次所有修改逐条过核心原则 🔍 自检：

1. 是否有 band-aid 修复？（原则 1）
2. 涉及第三方 API 是否查了文档？（原则 2）
3. 是否有 `as any` / 不必要的 `?.`？（原则 3）
4. 是否有吞错误的 catch / 无反馈的失败路径？（原则 4）
5. 新增的类型/字段是否全管道贯穿？（原则 5）

### Phase 4 — 验证

1. 运行单个 spec：`pnpm exec playwright test e2e/specs/<file> --reporter=list`
2. 确认通过后检查是否需要更新 test timeout
3. 失败时利用 trace（`test-results/` 中自动保存）诊断

## 命名规范

- Night-role spec 文件名：`night-roles-<category>.spec.ts`
  - 类别：check / kill / protect / block / treasure / thief-cupid / piper / gargoyle / eclipse-wolf-queen / hidden-wolf-crow
- 非 night spec：`<feature>.spec.ts`（如 `seating.spec.ts`、`reconnect.spec.ts`）
- Test describe/test 名用英文，描述具体场景和预期结果

## ⚠️ 常见踩坑（必读）

### 1. 步骤顺序导致角色被自动跳过

`waitForRoleTurn` 对 OTHER pages 调用 `tryClickAdvanceButton(includeSkip=true)`，会点击"不用技能"。如果你先驱动后面的角色，前面的角色会在等待过程中被自动跳过。

❌ 错误（crow 在 wolf 之前行动，先驱动 wolf 会导致 crow 被跳过）：

```typescript
await waitForRoleTurn(wolfPage, ['袭击'], pages);
await driveWolfVote(...);
await waitForRoleTurn(crowPage, ['诅咒'], pages); // 永远检测不到：已被自动跳过
```

✅ 正确：

```typescript
await waitForRoleTurn(crowPage, ['诅咒'], pages);
await clickSeatAndConfirm(crowPage, target);
await waitForRoleTurn(wolfPage, ['袭击'], pages);
await driveWolfVote(...);
```

### 2. chooseSeat/confirm 步骤的初始 alert

所有 `chooseSeat` 和 `confirm` 步骤在进入时都会弹一个 prompt alert（"知道了"按钮）。

- `clickSeatAndConfirm` 内部已处理（自动 dismissAlert）。
- `clickBottomButton` **不会** 自动 dismiss（仅在 retry 时才 dismiss）。
- 因此在 `clickBottomButton` 前必须手动 `await dismissAlert(page)`。

### 3. 座位号格式

- `roleMap.get(idx)!.seat` — 0-based 座位索引
- seer 等角色的 reveal dialog 使用 1-indexed display（`formatSeat(seat)` = `${seat+1}号`）
- 断言 reveal 文本时用 `${seat + 1}号`
- `clickSeatAndConfirm(page, seat)` 的 seat 参数是 0-based

### 4. waitForRoleTurn 的 keywords

keywords 匹配 `action-message` 文本 OR `alert-modal` 文本。选择的关键词应来自该步骤的 schema `prompt` 字段。常用：

- 狼人：`['袭击', '选择']`
- 预言家：`['查验', '选择']`
- 女巫：`['是否', '解药']`（save）/ `['是否', '毒药']`（poison）
- 守卫：`['守护', '选择']`
- 乌鸦：`['诅咒', '选择']`
- 隐狼 confirm：`['查看', '同伴']`
- 复仇者 confirm：`['阵营']`

查看具体角色的 prompt：`grep -A5 "stepId.*'<stepId>'" packages/game-engine/src/models/roles/spec/specs.ts`

### 5. 参考测试文件索引

| 模式                | 参考文件                               | 关键行 |
| ------------------- | -------------------------------------- | ------ |
| chooseSeat + reveal | `night-roles-check.spec.ts`            | seer   |
| chooseSeat + skip   | `night-roles-block.spec.ts`            | L413   |
| confirm step        | `night-roles-hidden-wolf-crow.spec.ts` | L70    |
| confirm + gate      | `night-roles-check.spec.ts`            | L656   |
| wolf empty vote     | `night-roles-kill.spec.ts`             | —      |
| magician swap       | `night-roles-check.spec.ts`            | —      |
| death verify        | `night-verify.spec.ts`                 | —      |

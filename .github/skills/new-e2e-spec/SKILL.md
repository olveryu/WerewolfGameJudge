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
| `waitForRoleTurn(page)`                     | 等待该角色行动轮      |
| `clickSeatAndConfirm(page, seat)`           | 点击座位 + 确认       |
| `driveWolfVote(pages, roleMap, targetSeat)` | 狼人投票              |
| `waitForNightEnd(page)`                     | 等待天亮              |
| `readAlertText(page)`                       | 读取弹窗文本          |
| `dismissAlert(page)`                        | 关闭弹窗              |
| `viewLastNightInfo(page)`                   | 查看昨夜信息          |
| `clickBottomButton(page, text)`             | 点底部按钮            |

#### ConfigPage 模板配置

```typescript
configure: async (c) =>
  c.configureCustomTemplate({
    wolves: 1,
    gods: ['seer', 'witch'],
    villagers: 2,
    // 可选: thirdParty: ['cupid']
  });
```

### Phase 4 — 验证

1. 运行单个 spec：`pnpm exec playwright test e2e/specs/<file> --reporter=list`
2. 确认通过后检查是否需要更新 test timeout
3. 失败时利用 trace（`test-results/` 中自动保存）诊断

## 命名规范

- Night-role spec 文件名：`night-roles-<category>.spec.ts`
  - 类别：check / kill / protect / block / treasure / thief-cupid / piper / gargoyle
- 非 night spec：`<feature>.spec.ts`（如 `seating.spec.ts`、`reconnect.spec.ts`）
- Test describe/test 名用英文，描述具体场景和预期结果

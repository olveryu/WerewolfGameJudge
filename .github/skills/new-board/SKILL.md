---
name: new-board
description: 'Add a new preset board (板子/模板) to PRESET_TEMPLATES. Use when: adding a board, creating a template, new preset, 新增板子, 添加板子, 添加模板, 新增模板.'
argument-hint: '板子名 + 角色列表（如：狼王预言家 4民4狼 预言家+女巫+猎人+守卫）'
---

# 新增板子 Skill

端到端添加一个预设板子到 `PRESET_TEMPLATES`，从收集需求到验证通过。

## When to Use

- 用户要求新增/添加一个预设板子（模板）
- 用户描述了一组角色配置并希望加为预设

## Procedure

### Phase 1 — 收集信息

1. 从用户输入中提取已知字段。
2. 对照下表检查缺失项，**主动询问**所有缺失的必填字段（不猜测）：

| 必填字段 | 说明                                                               | 示例                            |
| -------- | ------------------------------------------------------------------ | ------------------------------- |
| 板子名   | 中文名（通常 3-6 字，不含人数后缀）                                | `狼王魔术师`                    |
| 分类     | `TemplateCategory.Classic` / `Advanced` / `Special` / `ThirdParty` | `Advanced`                      |
| 角色列表 | 完整 RoleId 数组（含重复的村民/狼人）                              | `['villager', 'villager', ...]` |

3. 验证所有 RoleId 合法 — 用 `grep_search` 在 `specs.ts` 中确认每个 RoleId 存在。
4. **如果角色列表中包含项目中不存在的新角色 → 先执行 `/new-role` skill 添加该角色，完成后再继续本 skill。**

### Phase 2 — 验证设计

对角色列表进行以下检查：

| 检查项         | 要求                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| 玩家人数       | 12 人；`getPlayerCount(roles)` 计算实际人数（底牌角色不计入）                           |
| 阵营平衡       | 狼人通常 3-4，神职通常 3-4，村民填充剩余位置                                            |
| 无重复特殊角色 | 除 `villager` / `wolf` 外，每个特殊角色最多出现 1 次                                    |
| 底牌角色       | `treasureMaster` 需额外 3 张底牌、`thief` 需 2 张（加在 roles 末尾，roles.length > 12） |
| 命名规范       | 不含人数后缀（人数从 roles 派生），3-6 字中文                                           |

**输出变更计划，等待用户确认后再编码。**

### Phase 3 — 实现（用户确认后）

#### 步骤 1 — 添加 PRESET_TEMPLATES 条目

**文件**: `packages/game-engine/src/models/Template.ts`

在对应分类区块末尾添加：

```typescript
{
  name: '板子名',
  category: TemplateCategory.Advanced, // Classic | Advanced | Special | ThirdParty
  roles: [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'roleId1',
    'seer',
    'witch',
    'hunter',
    'guard',
  ],
},
```

**排列约定**：先村民 → 狼人 → 特殊狼人 → 神职 → 特殊角色 → 底牌（如有）。

#### 步骤 2 — 更新 guideContent 计数（如需要）

**文件**: `src/config/guideContent.ts`

搜索 `PRESET_TEMPLATES.length`，如果 guide 文案中硬编码了模板数量（如 `25 个预设板子`），更新为新数量。

> 当前实现用 `${PRESET_TEMPLATES.length}` 动态引用，通常**无需手动更新**。仅在文案硬编码数字时才改。

### Phase 4 — Integration Test

在 `src/services/__tests__/boards/` 下新增 integration test。

#### 4a. 新建 integration test 文件

**文件**: `src/services/__tests__/boards/night1.<主题>.<角色特征>.12p.integration.test.ts`

命名示例：`night1.guard.blocks_wolfkill.12p.integration.test.ts`

```typescript
import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '板子名';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  // seat 0-3: villager, seat 4-6: wolf, seat 7+: 特殊角色
  map.set(0, 'villager');
  // ...
  return map;
}

describe('Night-1: <主题描述> (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  it('<核心场景描述>', () => {
    ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    const result = executeFullNight(ctx, {
      wolf: 0,
      witch: { save: null, poison: null },
      seer: 4,
      // ...其他角色行动
    });

    expect(result.completed).toBe(true);
    // 断言 currentNightResults / reveal / deaths
    expect(ctx.getGameState().currentNightResults?.xxx).toBe(yyy);
  });
});
```

**必须包含**至少一个主题字段断言（非纯 deaths）：
`currentNightResults?.xxx` / `seerReveal` / `psychicReveal` / `gargoyleReveal` / `actions?.xxx` 等。

#### 4b. 注册到 boards coverage contract

**文件**: `src/services/__tests__/boards/night1.boards.coverage.contract.test.ts`

1. 在 `REQUIRED_12P_TEMPLATES` 数组中添加板子名
2. 在 `TEMPLATE_TO_TEST_PATTERN` 中添加对应的正则

```typescript
// REQUIRED_12P_TEMPLATES
'新板子名',

// TEMPLATE_TO_TEST_PATTERN
新板子名: /TEMPLATE_NAME\s*=\s*['"]新板子名['"]/,
```

### Phase 5 — 验证

1. **运行合约测试**确保数据自洽：

   ```bash
   pnpm exec jest --testPathPattern="Template.contract" --no-coverage
   ```

   合约测试会自动验证：
   - 所有 RoleId 合法
   - 无重复特殊角色
   - numberOfPlayers 与 getPlayerCount 一致
   - actionOrder 符合 NightPlan 顺序
   - 名称无人数后缀

2. **运行 boards coverage contract**确保 integration test 注册正确：

   ```bash
   pnpm exec jest --testPathPattern="night1.boards.coverage.contract" --no-coverage
   ```

3. **运行 nightPlanSchemas 合约测试**确保夜晚计划有效：

   ```bash
   pnpm exec jest --testPathPattern="nightPlanSchemas.contract" --no-coverage
   ```

4. **全量验证**：
   ```bash
   pnpm run quality
   ```
   snapshot 变更用 `pnpm exec jest --updateSnapshot`。

### Phase 6 — 收尾

- 确认 `pnpm run quality` 全绿
- 更新 `README.md` 和 `README.en.md` 中的预设板子数量（如：「27 套预设板子」→「28 套预设板子」）
- 更新 `docs/PRESET_BOARDS.md` 预设板子参考文档（在对应分类表格中追加新板子）
- 总结变更文件清单
- 提示用户提交：`feat(models): add <boardName> preset template`

---

## 分类选择指南

| 分类         | 适用场景                           | 示例                       |
| ------------ | ---------------------------------- | -------------------------- |
| `Classic`    | 入门级/经典配置                    | 预女猎白、狼美守卫         |
| `Advanced`   | 含进阶角色（石像鬼/噩梦/摄梦人等） | 石像鬼守墓人、噩梦之影守卫 |
| `Special`    | 特殊玩法/独特机制组合              | 纯白夜影、假面舞会         |
| `ThirdParty` | 含第三方阵营角色                   | 吹笛者、影子复仇者         |

---

## 参考角色索引（按阵营）

| 阵营   | 可选角色                                                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 村民   | `villager`（可重复）                                                                                                                                                                                                   |
| 狼人   | `wolf`（可重复）, `wolfQueen`, `wolfKing`, `darkWolfKing`, `wolfWitch`, `wolfRobot`, `bloodMoon`                                                                                                                       |
| 神职   | `seer`, `witch`, `hunter`, `guard`, `idiot`, `knight`, `witcher`, `mirrorSeer`, `drunkSeer`, `psychic`, `gargoyle`, `graveyardKeeper`, `silenceElder`, `votebanElder`, `pureWhite`, `spiritKnight`, `dancer`, `warden` |
| 功能   | `magician`, `nightmare`, `dreamcatcher`, `slacker`, `wildChild`, `avenger`, `shadow`, `masquerade`                                                                                                                     |
| 觉醒   | `awakenedGargoyle`                                                                                                                                                                                                     |
| 第三方 | `piper`                                                                                                                                                                                                                |
| 底牌   | `treasureMaster`（+3 底牌）, `thief`（+2 底牌）                                                                                                                                                                        |

> 此索引可能随版本变化。如果不确定某 RoleId 是否存在，用 `grep_search` 在 `specs.ts` 中验证。

---

## Key Constraints

- 板子名**不含**人数后缀（人数由 `roles.length` 派生）
- 除 `villager` / `wolf` 外，**特殊角色不重复**
- `treasureMaster` 需额外 3 张底牌角色、`thief` 需 2 张
- 所有 RoleId 必须在 `ROLE_SPECS` 中存在
- 板子按分类区块放置，同分类内按顺序追加到末尾

## Quality Checklist

- [ ] 板子名 3-6 字中文，无人数后缀
- [ ] 分类正确（Classic / Advanced / Special / ThirdParty）
- [ ] 所有 RoleId 合法
- [ ] 无重复特殊角色
- [ ] 阵营平衡合理
- [ ] Integration test 已创建，包含主题字段断言
- [ ] `REQUIRED_12P_TEMPLATES` + `TEMPLATE_TO_TEST_PATTERN` 已注册
- [ ] Template.contract 测试通过
- [ ] boards.coverage.contract 测试通过
- [ ] nightPlanSchemas.contract 测试通过
- [ ] `README.md` + `README.en.md` 预设板子数量已更新
- [ ] `docs/PRESET_BOARDS.md` 预设板子参考文档已更新
- [ ] `pnpm run quality` 全绿

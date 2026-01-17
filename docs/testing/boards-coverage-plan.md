# 模板测试体系整理 - 独有机制覆盖表

## 总目标

1. 每个 `PRESET_TEMPLATE` 保留最少但关键的 boards integration：只测试 "Host 跑完整个 Night-1 + 该模板独特机制"
2. 表驱动/静态契约断言集中到 contract tests
3. DeathCalculator 单测与 boards 分离
4. 新增/保留的 integration 必须继续走真实 player→host 消息路径

---

## 当前状态

| 文件                       | 测试数 | 行数 | 备注                                    |
| -------------------------- | ------ | ---- | --------------------------------------- |
| DeathCalculator.test.ts    | 41     | 584  | 纯单测，已整合所有 DeathCalculator 场景 |
| BloodMoonWitcher12         | 11     | 245  | ✅ 迁移完成                             |
| DarkWolfKingDreamcatcher12 | 11     | 225  | -                                       |
| DarkWolfKingGuard12        | 11     | 256  | ✅ 迁移完成                             |
| DarkWolfKingMagician12     | 13     | 263  | ⏳ 待补 magician swap 测试              |
| GargoyleGraveyardKeeper12  | 13     | 254  | -                                       |
| NightmareGuard12           | 9      | 280  | ✅ 迁移完成（保留 Host Gate 测试）      |
| SpiritKnight12             | 11     | 248  | ✅ 迁移完成                             |
| StandardBoard12            | 9      | 183  | 基准盘                                  |
| WolfQueenGuard12           | 9      | 217  | ✅ 迁移完成                             |
| WolfRobotPsychicGuard12    | 16     | 285  | -                                       |

**总计**: 113 boards tests + 41 DeathCalculator tests = 154 tests

---

## 模板独有机制覆盖表

| Template             | 独有机制（Night-1 相关）                              | boards 必测（2~4 条）                                              | 复杂交互必须 cover                  | 可删除/迁移的现有 tests                 |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | --------------------------------------- |
| **标准板12人**       | 无技能狼/无守卫（基准盘）                             | 1) wolf kill 2) witch save 3) witch poison                         | save vs poison 结算互斥；info 文案  | 基础 case 保留作为基准                  |
| **狼美守卫12人**     | **狼美链接**：狼美死→被链者死                         | 1) wolfQueen 被刀→连坐 2) wolfQueen 被毒→连坐 3) guard 挡刀→无连坐 | 狼美死亡触发连坐（刀/毒两种来源）   | DeathCalculator 单测移走                |
| **狼王守卫12人**     | darkWolfKing 死亡方式影响开枪资格                     | 1) wolf kill 基础 2) darkWolfKing 被刀 3) darkWolfKing 被毒        | 毒死 vs 刀死类别区分                | DeathCalculator 单测移走                |
| **石像鬼守墓人12人** | **gargoyle reveal 私信**                              | 1) GARGOYLE_REVEAL 断言 2) wolf kill 基础                          | reveal 结果基于 swap 后身份（TODO） | 静态 spec 断言移到 contract             |
| **梦魇守卫12人**     | **nightmare block**：被封锁者当晚技能无效             | 1) happy path 2) blocked 影响死亡结算（任一）                      | Host gate 细节迁移到单独测试        | DeathCalculator 单测移走；gate 单测移走 |
| **血月猎魔12人**     | **witcher 免疫女巫毒**                                | 1) witch poison witcher → 不死 2) wolf kill 基础                   | 只锁死毒免疫                        | DeathCalculator 单测移走                |
| **狼王摄梦人12人**   | **梦游者保护 + 摄梦人死→连坐**                        | 1) 梦游者被刀不死 2) 摄梦人死→连坐 3) 被救则不连坐（可选）         | 连坐触发条件                        | 保留关键 case                           |
| **狼王魔术师12人**   | **swap 影响检验类 reveal；witch save 不受 swap 影响** | 1) swap 后 seer reveal 2) witch save 原始目标 3) 基础 wolf kill    | **高优先缺口**：需补齐              | 需新增 magician swap 支持               |
| **机械狼通灵守12人** | **wolfRobot/psychic reveal 私信**                     | 1) WOLF_ROBOT_REVEAL 断言 2) PSYCHIC_REVEAL 断言 3) guard 挡刀     | reveal 存在性锁                     | 静态 spec 断言移到 contract             |
| **恶灵骑士12人**     | **spiritKnight 免疫+反伤**                            | 1) seer 查→反伤死 2) witch 毒→反伤死 3) wolf 刀→免疫               | 反伤触发条件                        | DeathCalculator 单测移走                |

---

## 改动清单

### A. 需要删除/迁移的 Tests

#### ✅ 已完成：从 boards 迁移到 `src/services/__tests__/DeathCalculator.test.ts`

- `BloodMoonWitcher12.integration.test.ts`: `describe('DeathCalculator - Witcher Immunity')` → 迁移到 `Witch Poison` section
- `DarkWolfKingGuard12.integration.test.ts`: `describe('DeathCalculator - Guard Protection')` → 迁移到 `Guard Protection` section
- `NightmareGuard12.integration.test.ts`: `describe('DeathCalculator - Nightmare Block')` → 新增 `Nightmare Block Effects` section
- `SpiritKnight12.integration.test.ts`: `describe('DeathCalculator - SpiritKnight Reflection')` → 新增 `Spirit Knight Reflection` section
- `WolfQueenGuard12.integration.test.ts`: `describe('DeathCalculator - WolfQueen Charm')` → 合并到 `Wolf Queen Link Death` section

#### 保留在 boards 中（需要 integration 环境）：

- `NightmareGuard12.integration.test.ts`: `describe('Host Authoritative Gate')` — 需要 nightmare 封锁 + handlePlayerAction 真实交互

### B. 需要瘦身的重复 Tests

跨模板重复的基础 case（只保留 StandardBoard12 作为基准）：

- "狼空刀：平安夜" - 多个模板重复
- "女巫毒人：毒药目标死亡" - 多个模板重复
- "狼人刀女巫，无人救" - 多个模板重复
- "双死亡" - 多个模板重复

### C. 需要新增的 Tests

#### 1. Magician swap 端到端（高优先）

- swap 后 seer reveal 按 swap 后身份
- witch save 仍以原始 wolfKillTarget 为准

#### 2. 私信 reveal 存在性锁

- `WolfRobotPsychicGuard12`: WOLF_ROBOT_REVEAL + PSYCHIC_REVEAL 断言
- `StandardBoard12`: SEER_REVEAL 断言（基准）

---

## hostGameFactory 对 magician 的支持

### actions 形状（mini contract）

```typescript
interface NightActionSequence {
  // 现有
  [role: string]: number | null | undefined;
  witchPoison?: number | null;

  // 新增：magician swap 支持（测试层使用对象格式，内部编码为 encoded target）
  magician?: { firstSeat: number; secondSeat: number } | null;
}
```

### processRoleAction 处理逻辑

**Wire Protocol (encoded target)**：Magician swap 使用 `target = firstSeat + secondSeat * 100`，不使用 `extra`。
这与 UI (`getMagicianTarget`) 和 Host (`handlePlayerAction`) 的实现一致。

```typescript
if (currentRole === 'magician') {
  const magicianAction = actions.magician;
  if (magicianAction && typeof magicianAction === 'object') {
    // Wire: encoded target = firstSeat + secondSeat * 100
    // 要求 secondSeat >= 1，保证 target >= 100（便于 host decode 识别）
    target = magicianAction.firstSeat + magicianAction.secondSeat * 100;
    extra = undefined;
  } else {
    target = null;
    extra = undefined;
  }
}
```

---

## 验收标准

- [x] DeathCalculator 单测从 boards 迁移完成（41 tests）
- [x] `npx jest src/services/__tests__/boards --runInBand` 全绿
- [x] `npx jest src/services/__tests__/DeathCalculator.test.ts --runInBand` 全绿（41 tests）
- [x] `npx tsc --noEmit` 通过
- [x] Magician swap 端到端测试补齐
- [x] 私信 reveal 存在性锁补齐（SEER_REVEAL, PSYCHIC_REVEAL, WOLF_ROBOT_REVEAL）
- [ ] 每个模板 boards integration ≤ 4 条（后续瘦身）
- [ ] DeathCalculator 单测独立文件
- [ ] Host Gate 单测独立文件

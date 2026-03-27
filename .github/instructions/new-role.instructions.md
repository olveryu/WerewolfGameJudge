```instructions
---
applyTo: ''
---

# 新增角色 SOP

本文件定义「添加一个新角色」的完整流程。代码模板和详细参考见 `docs/new-role-templates.md`。

---

## 用户需提供的最小信息

| 字段 | 说明 | 示例 |
|---|---|---|
| **角色名** | 中文名 + camelCase id | 狐狸 / `fox` |
| **阵营** | `Faction.Villager` / `Faction.God` / `Faction.Wolf` / `Faction.Special` | `Faction.God` |
| **team** | `Team.Good` / `Team.Wolf` / `Team.Third`（决定预言家查验结果） | `Team.Good` |
| **shortName** | 单字简称（全局唯一） | `狐` |
| **emoji** | 角色图标 emoji | `🦊` |
| **description** | 一句话技能描述（文案规范见模板文档） | 每晚查验一名玩家… |
| **Night-1 有行动？** | `true` / `false` | `true` |
| **行动类型** | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / `multiChooseSeat` / `groupConfirm` / 无 | `chooseSeat` |
| **约束** | `[]` / `[TargetConstraint.NotSelf]` / `[TargetConstraint.NotWolfFaction]` | `[TargetConstraint.NotSelf]` |
| **可跳过？** | `true` / `false` | `true` |
| **夜晚行动顺序** | 在哪个现有角色之前/之后 | 在 seer 之前 |
| **狼人会议配置**（仅狼阵营） | canSeeWolves / participatesInWolfVote | — |
| **特殊机制** | reveal 结果 / 影响死亡计算 / 预设上下文 / flags / displayAs | 无 |

信息不全时 Copilot 应主动询问缺失项，不猜测。

---

## 步骤清单（有夜晚行动的角色）

没有夜晚行动的角色只需步骤 1、9、10、11。

> **NOTE**: 角色是否有夜晚行动由 `NIGHT_STEPS` 数组决定（`hasNightAction()` 从 `nightSteps.length > 0` 推导）。`ROLE_SPECS` 中无需声明 `night1` 字段。

每步的代码模板、字段参考、音频/徽章生成指南见 `docs/new-role-templates.md`。

| # | 步骤 | 文件 | 说明 |
|---|------|------|------|
| 1 | ROLE_SPECS | `game-engine/src/models/roles/spec/specs.ts` | 在对应阵营区块添加条目；RoleId 自动推导 |
| 2 | SCHEMAS | `game-engine/src/models/roles/spec/schemas.ts` | 按 kind 选模板；SchemaId 自动推导 |
| 3 | NIGHT_STEPS | `game-engine/src/models/roles/spec/nightSteps.ts` | 按夜晚顺序在正确位置插入；id === SchemaId |
| 4 | Resolver | 见下方决策表 | 大多数角色用 genericResolver，无需新建文件 |
| 5 | 注册 Resolver | `game-engine/src/resolvers/index.ts` | Generic → `createGenericResolver()`；Custom → 在对应区块导入 |
| 6 | 音频文件 | `assets/audio/` + `scripts/generate_audio_edge_tts.py` | 编写旁白 → `python3 scripts/generate_audio_edge_tts.py --only <key>` |
| 7 | 注册音频 | `src/services/infra/audio/audioRegistry.ts` | `AUDIO_REGISTRY` + 多步骤角色用 `STEP_AUDIO` |
| 8 | ConfigScreen | `src/screens/ConfigScreen/configData.ts` | `FACTION_GROUPS` 对应阵营添加条目 |
| 8b | 角色徽章 | `assets/badges/png/512/` + `src/utils/roleBadges.ts` | AI 生成 512×512 PNG → 放置 → 注册 BADGE_MAP |
| 9 | Resolver 单测 | `game-engine/src/resolvers/__tests__/` | 跳过 / 有效 / 不存在 / 约束违反 + 角色特有 case |
| 10 | 合约测试计数 | `specs.contract.test.ts` + `v2Specs.contract.test.ts` | 角色总数 +1；同步添加 V2 spec |
| 11 | 验证 | — | `pnpm run quality`；snapshot 变更用 `pnpm exec jest --updateSnapshot` |

### Resolver 决策表

| 模式 | genericResolver | 独立 resolver |
|------|----------------|---------------|
| chooseSeat + writeSlot | ✅ guard, dreamcatcher, silenceElder, votebanElder, wolfQueen | |
| chooseSeat + check | ✅ seer 家族, psychic, gargoyle, pureWhite, wolfWitch | |
| chooseIdol / confirm / block / learn | ✅ slacker, wildChild, hunter, darkWolfKing, avenger, nightmare, wolfRobot | |
| compound / wolfVote / swap | | ✅ witch, wolf, magician |
| 跨角色联动 / 多目标+级联 | | ✅ shadow, piper, awakenedGargoyle |

**genericResolver 路径**: 无需新建文件，确保 ROLE_SPECS `abilities` 正确 → 步骤 5 注册 `createGenericResolver('roleId')`。

**独立 resolver 路径**: 新建 `resolvers/<newRole>.ts`（模板见 `docs/new-role-templates.md`）。

### description 文案规范

- **句式**: `[时间] + [动作] + [目标] + [效果] + [限制]`
- **长度**: 15~50 字（复杂 ≤60）；**句末不加句号**
- **统一术语**: 袭击（非猎杀）、出局（非死亡）、查验阵营/身份、免疫、首夜、阿拉伯数字
- **语气**: 客观三人称，禁止自指角色名（用「自身」「自己」）
- **标点**: 中文全角；逗号分并列，分号分规则

---

## 条件步骤（仅特殊机制角色需要，详见 `docs/new-role-templates.md`）

| 条件步骤 | 适用场景 | 关键文件 |
|----------|----------|----------|
| C1 Reveal | 查验类（seer / psychic / gargoyle 等） | `schema.types.ts` RevealKind + `protocol/types.ts` + `normalize.ts` |
| C2 死亡计算 | 守护/连带/免疫类 | `DeathCalculator.ts` NightActions + `resolvers/types.ts` CurrentNightResults |
| C3 预设上下文 | witch / hunter / wolfRobot 等 | `stepTransitionHandler.ts` |
| C4 新 Schema Kind | 现有 kind 不够用 | `schema.types.ts` + `actionHandler.ts` + 客户端 UI |
| C5 新 GameState 字段 | 任何新字段 | `protocol/types.ts` + `normalize.ts`（编译守卫） |
| C6 预设模板 | 含新角色模板（可选） | `models/Template.ts` PRESET_TEMPLATES |
| C7 E2E | 按行为分类 | `e2e/specs/night-roles-*.spec.ts` |
| C8 multiChooseSeat | 多目标选择（如 piper） | `schemas.ts` kind + resolver 读 `input.targets` |
| C9 groupConfirm | 全员确认（如 piper 第二步） | `schemas.ts` kind + `STEP_AUDIO` 注册 |
| C10 多步骤 | 同角色多 NIGHT_STEPS 条目 | 每步各需 schema + resolver + 音频 |

---

## 关键约束（违反则合约测试失败）

- `NIGHT_STEPS[*].id` **必须** === 对应 `SchemaId`
- `NIGHT_STEPS[*].audioKey` 默认**必须** === `roleId`（例外：多步骤非首步）
- `ROLE_SPECS` 中有 `nightSteps` 的角色**必须**在 `NIGHT_STEPS` 中至少出现一次
- Resolver 校验**必须**与 `SCHEMAS[*].constraints` 双向一致
- 新增 `GameState` 字段**必须**同步 `normalizeState`
- `shortName` 全局唯一（单字）
- `bottomActionText` ≤ 4 汉字
- `AUDIO_REGISTRY` 必须覆盖所有 `NIGHT_STEPS` 中的 unique `roleId`
- `TargetConstraint` 用枚举引用，不用字符串
```

---
name: new-role
description: 'Add a new werewolf role end-to-end: spec, schema, night step, resolver, audio, badge, config, tests. Use when: adding a role, creating a character, new role SOP, 新增角色, 添加角色.'
argument-hint: '角色名 + 阵营 + 技能简述（如：狐狸 神职 每晚查验一名玩家）'
---

# 新增角色 Skill

端到端添加一个狼人杀角色，从收集需求到全部验证通过。

## When to Use

- 用户要求新增/添加一个狼人杀角色
- 用户描述了一个新角色的技能并希望实现

---

## Procedure

### Phase 1 — 收集信息

1. 从用户输入中提取已知字段。
2. 对照下表检查缺失项，**主动询问**所有缺失的必填字段（不猜测）：

| 必填字段                 | 说明                                                                                                  | 示例                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| 角色名                   | 中文名 + camelCase id                                                                                 | 狐狸 / `fox`                 |
| 阵营                     | `Faction.God` / `Faction.Wolf` / `Faction.Villager` / `Faction.Special`                               | `Faction.God`                |
| team                     | `Team.Good` / `Team.Wolf` / `Team.Third`（决定预言家查验结果）                                        | `Team.Good`                  |
| shortName                | 单字简称（全局唯一）                                                                                  | `狐`                         |
| emoji                    | 角色图标 emoji                                                                                        | `🦊`                         |
| description              | 一句话技能描述（遵循文案规范）                                                                        | 每晚查验一名玩家…            |
| Night-1 有行动？         | `true` / `false`                                                                                      | `true`                       |
| 行动类型                 | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / `multiChooseSeat` / `groupConfirm` / 无 | `chooseSeat`                 |
| 约束                     | `[]` / `[TargetConstraint.NotSelf]` / `[TargetConstraint.NotWolfFaction]` 等                          | `[TargetConstraint.NotSelf]` |
| 可跳过？                 | `true` / `false`                                                                                      | `true`                       |
| 夜晚行动顺序             | 在哪个现有角色之前/之后                                                                               | 在 seer 之前                 |
| 狼人会议配置（仅狼阵营） | `canSeeWolves` / `participatesInWolfVote`                                                             | —                            |
| 特殊机制                 | reveal / 死亡计算 / 预设上下文 / flags / displayAs / 无                                               | 无                           |

3. 用 `grep_search` 验证 `shortName` 全局唯一。
4. 确认 description 符合文案规范（见下方「description 文案规范」节）。

> **NOTE**: 角色是否有夜晚行动由 `NIGHT_STEPS` 数组决定（`hasNightAction()` 从 `nightSteps.length > 0` 推导）。`ROLE_SPECS` 中无需声明 `night1` 字段。

### Phase 2 — 制定变更计划

根据 Resolver 决策表和条件步骤，确定：

- 是否需要夜晚行动步骤（Night-1 行动 → 步骤 1-8；无行动 → 仅步骤 1、9-11）
- genericResolver 还是独立 resolver（查决策表）
- 需要哪些条件步骤（C1-C10）
- 列出完整变更文件清单 + 每个文件的变更点

**输出变更计划，等待用户确认后再编码。**

### Phase 3 — 实现（用户确认后）

按 SOP 顺序逐步实现，每步参考下方「代码模板」节。

#### 核心步骤（有夜晚行动的角色）

| #   | 步骤                       | 文件                                                       |
| --- | -------------------------- | ---------------------------------------------------------- |
| 1   | ROLE_SPECS 添加条目        | `packages/game-engine/src/models/roles/spec/specs.ts`      |
| 2   | SCHEMAS 添加条目           | `packages/game-engine/src/models/roles/spec/schemas.ts`    |
| 3   | NIGHT_STEPS 插入（按顺序） | `packages/game-engine/src/models/roles/spec/nightSteps.ts` |
| 4   | Resolver（generic 或独立） | 见「Resolver 决策表」                                      |
| 5   | 注册 Resolver              | `packages/game-engine/src/resolvers/index.ts`              |
| 6   | 音频文件生成               | 见「步骤 6 — 音频生成」                                    |
| 7   | 注册音频                   | `src/services/infra/audio/audioRegistry.ts`                |
| 8   | ConfigScreen 添加          | `src/screens/ConfigScreen/configData.ts`                   |
| 8b  | 角色徽章                   | 见「步骤 8b — 角色徽章生成」                               |

#### 无夜晚行动的角色

只需步骤 1、9、10、11。

#### 条件步骤（按需）

根据角色特殊机制选择 C1-C10（详见下方「条件步骤参考」节）。

### Phase 4 — 测试 & 验证

| #   | 步骤          | 方法                                                                                                      |
| --- | ------------- | --------------------------------------------------------------------------------------------------------- |
| 9   | Resolver 单测 | 新建 `resolvers/__tests__/<role>.resolver.test.ts`，覆盖：跳过 / 有效 / 不存在 / 约束违反 + 角色特有 case |
| 10  | 合约测试计数  | `specs.contract.test.ts` + `v2Specs.contract.test.ts` 角色总数 +1                                         |
| 11  | 全量验证      | `pnpm run quality`；snapshot 变更用 `pnpm exec jest --updateSnapshot`                                     |

### Phase 5 — 收尾

- 确认 `pnpm run quality` 全绿
- 更新 `README.md` 和 `README.en.md` 中的角色数量、阵营计数和角色列表
- 更新 `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md` 中的步骤顺序表和角色行为矩阵
- 确认 `docs/avatar-generation-prompts.md` 已追加新角色 prompt（步骤 8b.10）
- 确认 `scripts/badge-config.mjs` EMOJI_MAP 已添加新角色映射（步骤 8b.5）
- 确认 `rewardCatalog.ts` HAND_DRAWN_AVATAR_IDS + AVATAR_RARITY 已添加（步骤 8b.6-7）
- 确认 `avatarImages.ts` + `avatarImages.web.ts` 已注册（步骤 8b.8-9）
- 总结变更文件清单
- 提示用户提交（按 Conventional Commits：`feat(models): add <roleName> role`）

---

## Resolver 决策表

| 模式                                 | genericResolver                                                            | 独立 resolver                      |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| chooseSeat + writeSlot               | ✅ guard, dreamcatcher, silenceElder, votebanElder, wolfQueen              |                                    |
| chooseSeat + check                   | ✅ seer 家族, psychic, gargoyle, pureWhite, wolfWitch                      |                                    |
| chooseIdol / confirm / block / learn | ✅ slacker, wildChild, hunter, darkWolfKing, avenger, nightmare, wolfRobot |                                    |
| compound / wolfVote / swap           |                                                                            | ✅ witch, wolf, magician           |
| 跨角色联动 / 多目标+级联             |                                                                            | ✅ shadow, piper, awakenedGargoyle |

**genericResolver 路径**: 无需新建文件，确保 ROLE_SPECS `abilities` 正确 → 步骤 5 注册 `createGenericResolver('roleId')`。

**独立 resolver 路径**: 新建 `resolvers/<newRole>.ts`（模板见下方）。

---

## description 文案规范

- **句式**: `[时间] + [动作] + [目标] + [效果] + [限制]`
  - 有夜晚行动：「每晚…」「首夜…」「从第二夜起…」
  - 无夜晚行动：「被放逐时…」「白天可…」「出局时…」
- **长度**: 15~50 字（复杂角色 ≤60 字）；**句末不加句号**
- **统一术语**: 袭击（非猎杀/刀人）、出局（非死亡）、查验阵营/身份、免疫、首夜、阿拉伯数字
- **语气**: 客观三人称，禁止自指角色名（用「自身」「自己」）
- **标点**: 中文全角；逗号分并列，分号分规则

```text
# 查验阵营类
每晚可查验一名玩家的阵营，获知其是好人还是狼人
# 查验身份类
每晚可查验一名玩家的身份，获知其具体角色名称
# 选择目标类
每晚可选择一名玩家进行[动作]，[效果描述]；[限制条件]
# 被动技能类
[触发条件]时[效果]；[限制条件]
```

---

## 代码模板

### ROLE_SPECS

**文件**: `packages/game-engine/src/models/roles/spec/specs.ts`

在对应阵营区块添加条目。`RoleId` 从 `keyof typeof ROLE_SPECS` 自动推导。

```typescript
// chooseSeat 类神职
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.God,
  team: Team.Good,
  description: '技能描述',
},

// 狼人阵营
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '🐺',
  faction: Faction.Wolf,
  team: Team.Wolf,
  description: '技能描述',
  wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
},

// 第三方
newThird: {
  id: 'newThird',
  displayName: '中文名',
  shortName: '字',
  emoji: '🃏',
  faction: Faction.Special,
  team: Team.Third,
  description: '技能描述',
},

// 伪装角色
newDisguised: {
  id: 'newDisguised',
  displayName: '中文名',
  shortName: '字',
  emoji: '🪞',
  faction: Faction.Villager,
  team: Team.Good,
  description: '技能描述',
  displayAs: 'seer',
},
```

**可选字段**: `wolfMeeting?` / `flags?: { immuneToWolfKill?, immuneToPoison?, reflectsDamage? }` / `displayAs?`

### SCHEMAS

**文件**: `packages/game-engine/src/models/roles/spec/schemas.ts`

`SchemaId` 从 `keyof typeof SCHEMAS` 自动推导。

**bottomActionText 固定值**（4 字）: 跳过类 `'不用技能'`、确认类 `'发动状态'`、groupConfirm `'催眠状态'`

```typescript
// ---- chooseSeat 类（最常见）----
newRoleAction: {
  id: 'newRoleAction',
  displayName: '行动名',
  kind: 'chooseSeat',
  constraints: [TargetConstraint.NotSelf],
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择目标玩家，如不使用请点击「不用技能」',
    confirmText: '确定要对该玩家使用技能吗？',
    bottomActionText: '不用技能',
    // 有 reveal 结果时加：revealKind: 'newRole',
  },
},

// ---- confirm 类（查看发动状态）----
newRoleConfirm: {
  id: 'newRoleConfirm',
  displayName: '技能发动确认',
  kind: 'confirm',
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请点击下方按钮查看技能发动状态',
    confirmText: '确定查看发动状态吗？',
    bottomActionText: '发动状态',
    statusDialogTitle: '技能状态',
    canShootText: '可以发动技能',
    cannotShootText: '不能发动技能',
  },
},

// ---- multiChooseSeat 类（选多个目标）----
newRoleMulti: {
  id: 'newRoleMulti',
  displayName: '行动名',
  kind: 'multiChooseSeat',
  constraints: [TargetConstraint.NotSelf],
  minTargets: 1,
  maxTargets: 2,
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择1-2名目标玩家，如不使用请点击「不用技能」',
    confirmText: '确定要对选中的玩家使用技能吗？',
    bottomActionText: '不用技能',
    confirmButtonText: '确认行动({count}人)',
  },
},

// ---- groupConfirm 类（全员确认）----
newRoleGroupConfirm: {
  id: 'newRoleGroupConfirm',
  displayName: '状态确认',
  kind: 'groupConfirm',
  requireAllAcks: true,
  ui: {
    prompt: '所有玩家请睁眼，请看手机确认信息',
    bottomActionText: '催眠状态',
    hypnotizedText: '你已被影响，当前受影响的座位：{seats}',
    notHypnotizedText: '你未受影响',
    confirmButtonText: '我知道了',
  },
},

// swap / compound / wolfVote → 参考 magicianSwap / witchAction / wolfKill
```

### NIGHT_STEPS

**文件**: `packages/game-engine/src/models/roles/spec/nightSteps.ts`

```typescript
// 单步骤（最常见）
{
  id: 'newRoleAction',   // 必须 === SchemaId
  roleId: 'newRole',     // 必须 === RoleId
  audioKey: 'newRole',   // 默认必须 === roleId
},

// 多步骤角色的第二步
{
  id: 'newRoleSecondStep',
  roleId: 'newRole',
  audioKey: 'newRoleSecondStep',
  audioEndKey: 'newRoleSecondStep',
},
```

**现有 Night-1 顺序（27 步）**:

1. magicianSwap → slackerChooseIdol → wildChildChooseIdol
2. shadowChooseMimic → avengerConfirm
3. nightmareBlock → dreamcatcherDream → guardProtect → silenceElderSilence → votebanElderBan
4. wolfKill → wolfQueenCharm
5. witchAction
6. hunterConfirm → darkWolfKingConfirm
7. wolfRobotLearn → seerCheck → mirrorSeerCheck → drunkSeerCheck → wolfWitchCheck → gargoyleCheck → pureWhiteCheck → psychicCheck
8. awakenedGargoyleConvert
9. piperHypnotize → piperHypnotizedReveal → awakenedGargoyleConvertReveal

### 独立 Resolver

仅特殊角色需要（大多数角色用 `createGenericResolver()`，无需新建文件）。

**新建文件**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验 <角色名> 行动 + 计算结果。
 * 不包含 IO（网络 / 音频 / Alert）。
 */

import { SCHEMAS } from '../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const newRoleActionResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  const schema = SCHEMAS.newRoleAction;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  return {
    valid: true,
    // updates: { guardedSeat: target },
    // result: { guardedTarget: target },
  };
};
```

**ResolverContext 关键字段**: `actorSeat` / `actorRoleId` / `players: ReadonlyMap<number, RoleId>` / `currentNightResults` / `wolfRobotContext?` / `witchState?` / `gameState: { isNight1, hypnotizedSeats? }`

**ResolverResult 关键字段**: `valid` / `rejectReason?` / `updates?: Partial<CurrentNightResults>` / `result?: { checkResult?, identityResult?, ...角色特有字段 }`

### Resolver 单测

**新建文件**: `packages/game-engine/src/resolvers/__tests__/<newRole>.resolver.test.ts`

```typescript
import { newRoleActionResolver } from '@werewolf/game-engine/resolvers/newRole';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map([
    [0, 'villager'], [1, 'wolf'], [2, 'newRole'], [3, 'seer'],
  ] as [number, string][]);
  return {
    actorSeat: 2,
    actorRoleId: 'newRole',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  } as ResolverContext;
}

function createInput(target: number | null | undefined): ActionInput {
  return { schemaId: 'newRoleAction', target: target as number | undefined };
}

describe('newRoleActionResolver', () => {
  it('应该允许跳过', () => { ... });
  it('应该接受有效目标', () => { ... });
  it('应该拒绝不存在的目标', () => { ... });
  // ...角色特有 case
});
```

### 步骤 6 — 音频生成

**命名**: camelCase roleId → snake_case（`wolfQueen` → `wolf_queen.mp3`）

1. 在 `scripts/generate_audio_edge_tts.py` 中添加旁白文案：
   - `BEGIN_TEXT["<snake_case>"]` — `"XX请睁眼，请[行动描述]。"`
   - `END_TEXT["<snake_case>"]` — `"XX请闭眼。"`
2. **自动执行**生成命令（需 `.venv` 已激活）：
   ```bash
   python3 scripts/generate_audio_edge_tts.py --only <snake_case_key>
   ```
3. 确认 `assets/audio/<snake_case>.mp3` 和 `assets/audio_end/<snake_case>.mp3` 已生成。

**默认参数**: voice=`zh-CN-YunjianNeural` / pitch=`-20Hz` / rate=`-20%` / volume=`+100%` / boost=`10dB`

### 注册音频

**文件**: `src/services/infra/audio/audioRegistry.ts`

```typescript
newRole: {
  begin: require('../../../../assets/audio/new_role.mp3'),
  end: require('../../../../assets/audio_end/new_role.mp3'),
},
```

多步骤角色第二步在 `STEP_AUDIO` 中注册。查找链：`AUDIO_REGISTRY[roleId]` → `SEER_LABEL_AUDIO` → `STEP_AUDIO[audioKey]`。

### 步骤 8b — 角色徽章生成

**方式 A**: 用户提供现成 PNG → 跳到「放置与注册」。

**方式 B**: AI 文生图生成。

**工具**: 豆包 AI 文生图（或其他支持透明背景的 AI 工具）

**设置**: 1:1 正方形 / 24-30 步 / CFG 8-10 / DPM++ 2M Karras / 无模板

**Prompt** = 通用前缀 + 角色特征描述（30~80 字）

通用前缀（所有角色共用）：

```
狼人杀官方卡牌插画，蒂姆·波顿式暗黑怪诞童话风格，美式复古手绘插画，铅笔手绘松弛线条，水彩晕染上色，做旧粗糙纸张纹理，画面带细腻颗粒噪点，夸张变形的人物造型，长脸尖下巴，戏剧化的五官与肢体动作，粗粝手绘排线做阴影，暗黑诡异又诙谐的氛围感，高清细节，手绘质感拉满，PNG格式透明背景，alpha通道透明，纯透明无背景，无任何底色、场景、环境元素，背景完全空白透明，1:1正方形画幅，居中构图，半身像紧凑裁切，单个人物主体占画面80%，所有人物尺寸比例统一。
```

负面 Prompt（所有角色共用）：

```
文字、水印、logo、签名、多余边框、画框、相框、模糊、低画质、低分辨率、变形、比例失调、五官扭曲、多余肢体、缺手指、多手指、Q版、萌系、二次元动漫、真实照片、3D渲染、平滑数字绘画、赛璐珞上色、霓虹色、赛博朋克、高饱和荧光色、任何背景、底色、纯色背景、渐变背景、纸张背景、场景背景、环境背景、纹理背景、白色背景、黑色背景、带背景的画面、画面杂色、主体边缘白边、干净光滑的画面、无纹理、矢量图、线条僵硬、画面过曝、画面过暗、元素堆砌
```

根据角色特征编写 30~80 字的角色描述追加到通用前缀后面。参考已有角色 prompt 见 `docs/avatar-generation-prompts.md`。

**放置与注册**：

1. 原图保存到 `assets/avatars/raw/<roleId>.png`（透明背景 RGBA PNG）
2. 运行 `python3 scripts/process_avatars.py` 自动生成：
   - `assets/badges/png/512/role_<roleId>.png`（512px badge）
   - `assets/avatars/web/<roleId>.webp`（512px WebP avatar）
   - `assets/badges/web/role_<roleId>.webp`（128px WebP badge thumbnail）
3. `src/utils/roleBadges.ts` → `BADGE_MAP` 添加 native badge import
4. `src/utils/roleBadges.web.ts` → `BADGE_MAP` 添加 web badge import
5. `scripts/badge-config.mjs` → `EMOJI_MAP` 添加 `roleId: [folderName, fileName, hasSkinTone]` 映射（Fluent Emoji 3D 资源）
6. `packages/game-engine/src/growth/rewardCatalog.ts` → `HAND_DRAWN_AVATAR_IDS` 按字母序插入 roleId
7. `packages/game-engine/src/growth/rewardCatalog.ts` → `AVATAR_RARITY` 按稀有度区块插入（`legendary` / `epic`）
8. `src/utils/avatarImages.ts` → 添加 raw PNG import + badge PNG thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` 条目
9. `src/utils/avatarImages.web.ts` → 添加 WebP avatar import + WebP badge thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` 条目
10. 将生成 prompt 追加到 `docs/avatar-generation-prompts.md`（编号顺延，按阵营区块插入）

---

## 条件步骤参考

| 条件步骤             | 适用场景                      | 关键文件                                                 | 说明                                                                                             |
| -------------------- | ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C1 Reveal            | 查验类                        | `schema.types.ts` + `protocol/types.ts` + `normalize.ts` | RevealKind → GameState 字段 → Resolver `result: { checkResult }` → 使用 `resolveRoleForChecks()` |
| C2 死亡计算          | 守护/连带/免疫类              | `DeathCalculator.ts` + `resolvers/types.ts`              | NightActions → Resolver `updates` → CurrentNightResults 新字段                                   |
| C3 预设上下文        | witch / hunter / wolfRobot 等 | `stepTransitionHandler.ts`                               | 可能新建 `<newRole>Context.ts`                                                                   |
| C4 新 Schema Kind    | 现有 kind 不够用              | `schema.types.ts` + `actionHandler.ts` + 客户端 UI       | 新接口 → 分发 → UI 适配                                                                          |
| C5 新 GameState 字段 | 任何新字段                    | `protocol/types.ts` + `normalize.ts`                     | 编译守卫                                                                                         |
| C6 预设模板          | 含新角色模板（可选）          | `models/Template.ts`                                     | PRESET_TEMPLATES                                                                                 |
| C7 E2E               | 按行为分类                    | `e2e/specs/night-roles-*.spec.ts`                        |                                                                                                  |
| C8 multiChooseSeat   | 多目标选择                    | `schemas.ts` kind + resolver 读 `input.targets`          | `minTargets`/`maxTargets`                                                                        |
| C9 groupConfirm      | 全员确认                      | `schemas.ts` kind + `STEP_AUDIO` 注册                    | `requireAllAcks` → Resolver 对 `confirmed: true` 返回 valid                                      |
| C10 多步骤           | 同角色多 NIGHT_STEPS 条目     | 每步各需 schema + resolver + 音频                        | 第二步 `audioKey` 可不同 → `STEP_AUDIO` 注册                                                     |

---

## 参考角色索引

| 行动类型             | 参考角色                                                                                                         | SchemaId                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `chooseSeat`（查验） | seer, mirrorSeer, drunkSeer, psychic, gargoyle, pureWhite, wolfWitch                                             | `seerCheck` 等          |
| `chooseSeat`（效果） | guard, nightmare, dreamcatcher, wolfQueen, silenceElder, votebanElder                                            | `guardProtect` 等       |
| `chooseSeat`（学习） | wolfRobot                                                                                                        | `wolfRobotLearn`        |
| `chooseSeat`（选人） | slacker, wildChild, shadow                                                                                       | `slackerChooseIdol` 等  |
| `confirm`            | hunter, darkWolfKing, avenger                                                                                    | `hunterConfirm` 等      |
| `compound`           | witch                                                                                                            | `witchAction`           |
| `swap`               | magician                                                                                                         | `magicianSwap`          |
| `wolfVote`           | wolf                                                                                                             | `wolfKill`              |
| `multiChooseSeat`    | piper                                                                                                            | `piperHypnotize`        |
| `groupConfirm`       | piper（第二步）                                                                                                  | `piperHypnotizedReveal` |
| 无夜晚行动           | villager, idiot, knight, witcher, wolfKing, bloodMoon, spiritKnight, graveyardKeeper, dancer, masquerade, warden | —                       |

---

## Key Constraints

以下违反会导致合约测试失败（必须逐条检查）：

- `NIGHT_STEPS[*].id` **===** 对应 `SchemaId`
- `NIGHT_STEPS[*].audioKey` 默认 **===** `roleId`（例外：多步骤非首步）
- 有 `nightSteps` 的角色**必须**在 `NIGHT_STEPS` 中至少出现一次
- Resolver 校验**必须**与 `SCHEMAS[*].constraints` 双向一致
- 新增 `GameState` 字段**必须**同步 `normalizeState`
- `shortName` 全局唯一（单字）
- `bottomActionText` ≤ 4 汉字
- `AUDIO_REGISTRY` 必须覆盖所有 `NIGHT_STEPS` 中的 unique `roleId`
- `TargetConstraint` 用枚举引用，不用字符串

## Quality Checklist

实现完成后逐项确认：

- [ ] ROLE_SPECS 条目完整（faction / team / shortName / emoji / description）
- [ ] description 符合文案规范（句式 / 长度 / 术语 / 无句号）
- [ ] SCHEMAS 条目 kind / constraints / ui 正确
- [ ] NIGHT_STEPS 插入位置正确，id === SchemaId
- [ ] Resolver 注册且校验与 constraints 一致
- [ ] 音频生成 + 注册到 AUDIO_REGISTRY
- [ ] ConfigScreen FACTION_GROUPS 已添加
- [ ] 合约测试计数已更新
- [ ] `README.md` + `README.en.md` 角色数量/阵营计数/角色列表已更新
- [ ] `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md` 步骤顺序表 + 角色行为矩阵已更新
- [ ] `pnpm run quality` 全绿

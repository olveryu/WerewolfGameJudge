# 新增角色代码模板

> 本文件包含新增角色时各步骤的详细代码模板和参考信息。
> 规则和 checklist 见 `.github/instructions/new-role.instructions.md`。

---

## ROLE_SPECS 模板

**文件**: `packages/game-engine/src/models/roles/spec/specs.ts`

在对应阵营区块添加条目。`RoleId` 从 `keyof typeof ROLE_SPECS` 自动推导，无需手动加类型。

```typescript
import { Faction, Team } from './types';

// chooseSeat 类神职
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.God,     // God | Wolf | Villager | Special
  team: Team.Good,          // Team.Good | Team.Wolf | Team.Third
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

---

## description 文案规范

- **句式**: `[时间] + [动作] + [目标] + [效果] + [限制]`
  - 有夜晚行动：「每晚…」「首夜…」「从第二夜起…」
  - 无夜晚行动：「被放逐时…」「白天可…」「出局时…」
- **长度**: 15~50 字（复杂角色 ≤60 字）
- **标点**: 中文全角；逗号分隔并列，分号分隔规则；**句末不加句号**
- **语气**: 客观三人称；禁止自指角色名（用「自身」「自己」）
- **统一术语**: 袭击（非猎杀/刀人）、出局（非死亡）、查验阵营/身份、免疫、首夜、阿拉伯数字

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

## SCHEMAS 模板

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

---

## NIGHT_STEPS 模板

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

---

## 独立 Resolver 模板

仅特殊角色需要（大多数角色用 `createGenericResolver()`，无需新建文件）。

**新建文件**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验 <角色名> 行动 + 计算结果。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
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

---

## Resolver 单测模板

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

---

## 音频生成指南

**文件**: `assets/audio/<snake_case>.mp3` + `assets/audio_end/<snake_case>.mp3`

命名：camelCase roleId → snake_case（`wolfQueen` → `wolf_queen.mp3`）

### 编写旁白文案

在 `scripts/generate_audio_edge_tts.py` 中添加：

- `BEGIN_TEXT["<snake_case>"]` — `"XX请睁眼，请[行动描述]。"`
- `END_TEXT["<snake_case>"]` — `"XX请闭眼。"`

### 生成命令

```bash
python3 scripts/generate_audio_edge_tts.py --only <snake_case_key>
```

**前置依赖**: Python 3.8+ / `edge-tts` / `ffmpeg` / 联网

**默认参数**: voice=`zh-CN-YunjianNeural` / pitch=`-20Hz` / rate=`-20%` / volume=`+100%` / boost=`10dB`

更多用法见 `scripts/README-audio.md`。

### 注册音频

**文件**: `src/services/infra/audio/audioRegistry.ts`

```typescript
newRole: {
  begin: require('../../../../assets/audio/new_role.mp3'),
  end: require('../../../../assets/audio_end/new_role.mp3'),
},
```

多步骤角色第二步在 `STEP_AUDIO` 中注册。查找链：`AUDIO_REGISTRY[roleId]` → `SEER_LABEL_AUDIO` → `STEP_AUDIO[audioKey]`。

---

## 角色徽章生成指南

### 生成图片

**工具**: 豆包 AI 文生图（或其他支持透明背景的 AI 工具）

**设置**: 1:1 正方形 / 24-30 步 / CFG 8-10 / DPM++ 2M Karras / 无模板

**Prompt 结构** = 通用前缀 + 角色特征描述（30~80 字）

通用前缀（所有角色共用）：

```
狼人杀官方卡牌插画，蒂姆·波顿式暗黑怪诞童话风格，美式复古手绘插画，铅笔手绘松弛线条，水彩晕染上色，做旧粗糙纸张纹理，画面带细腻颗粒噪点，夸张变形的人物造型，长脸尖下巴，戏剧化的五官与肢体动作，粗粝手绘排线做阴影，暗黑诡异又诙谐的氛围感，高清细节，手绘质感拉满，PNG格式透明背景，alpha通道透明，纯透明无背景，无任何底色、场景、环境元素，背景完全空白透明，1:1正方形画幅，居中构图，半身像紧凑裁切，单个人物主体占画面80%，所有人物尺寸比例统一。
```

负面 Prompt（所有角色共用）：

```
文字、水印、logo、签名、多余边框、画框、相框、模糊、低画质、低分辨率、变形、比例失调、五官扭曲、多余肢体、缺手指、多手指、Q版、萌系、二次元动漫、真实照片、3D渲染、平滑数字绘画、赛璐珞上色、霓虹色、赛博朋克、高饱和荧光色、任何背景、底色、纯色背景、渐变背景、纸张背景、场景背景、环境背景、纹理背景、白色背景、黑色背景、带背景的画面、画面杂色、主体边缘白边、干净光滑的画面、无纹理、矢量图、线条僵硬、画面过曝、画面过暗、元素堆砌
```

**后处理**: 确认透明背景 → 裁剪 512×512 PNG

**Prompt 归档**: 追加到 `docs/avatar-generation-prompts.md`。现有 Prompt 参考同文件。

### 放置与注册

1. `assets/badges/png/512/role_<roleId>.png`（512×512）
2. `src/utils/roleBadges.ts` — `BADGE_MAP` 添加 `require()` 行
3. （可选）`scripts/badge-config.mjs` — Fluent Emoji 备用

---

## 条件步骤参考

### C1 — Reveal 结果（查验类）

`schema.types.ts` RevealKind → `protocol/types.ts` GameState 字段 → `normalize.ts` → `reducer/types.ts` payload → Resolver `result: { checkResult }` → 使用 `resolveRoleForChecks()`

### C2 — 影响死亡计算（守护/连带/免疫类）

`DeathCalculator.ts` NightActions → Resolver `updates` → `resolvers/types.ts` CurrentNightResults 新字段

### C3 — 预设上下文 / Gate

`stepTransitionHandler.ts` → 可能新建 `<newRole>Context.ts`

### C4 — 新 Schema Kind

`schema.types.ts` 新接口 → `actionHandler.ts` 分发 → 客户端 UI 适配

### C5 — 新 GameState 字段

`protocol/types.ts` → `normalize.ts`（编译守卫）→ `reducer/types.ts`

### C6 — 预设模板

`models/Template.ts` `PRESET_TEMPLATES` 添加含新角色模板（可选）

### C7 — E2E 测试

`e2e/specs/night-roles-*.spec.ts` 按角色行为分类

### C8 — multiChooseSeat

`schemas.ts` `kind: 'multiChooseSeat'` + `minTargets`/`maxTargets` → Resolver 读 `input.targets`

### C9 — groupConfirm

`schemas.ts` `kind: 'groupConfirm'` + `requireAllAcks` → Resolver 对 `confirmed: true` 返回 valid → 通常作第二步骤

### C10 — 多步骤角色

`NIGHT_STEPS` 多条目同 `roleId` → 第二步 `audioKey` 可不同 → `STEP_AUDIO` 注册 → 各步各有 schema + resolver

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

# 游戏配置 Schema 驱动设计

> 状态：已实施（PR #325，2026-10-27）。§1 记录改造前的现状供追溯；§4–§8 描述当前实现；决策记录见 §2。
> 关联：[room-shell-contract.md](room-shell-contract.md) §Configuration、[multigame-platform-design.md](multigame-platform-design.md) §21.8 / §25。

## 1. 现状

### 1.1 三种 config screen 写法并存

| 写法                              | 游戏                                   | 入口文件                                                                                                                                              |
| --------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 共享 `useRoomConfigSubmission` | avalon / demo / drawguess / storyrelay | `src/games/<game>/screens/<Game>ConfigScreen.tsx`                                                                                                     |
| B. 手写同样的编排                 | undercover / fibking / pictionary      | `UndercoverConfigScreen.tsx`、`useFibConfigScreenState.ts`、`usePictionaryConfigScreenState.ts`                                                       |
| C. 三步 nested stack              | werewolf                               | `src/games/werewolf/navigation/WerewolfConfigFlowScreen.tsx`：`BoardPickerScreen` → `ConfigScreen`（角色选择）→ `GameRulesScreen`（规则 + 创建/保存） |

### 1.2 七份重复样板

以下代码在 7 个非狼人杀 config screen 里逐字或近似重复：

- `useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>()` + `useRoute` + `parse<Game>ConfigRouteParams(route.params)`
- `readInitialConfig`：create → `DEFAULT_<GAME>_CONFIG`；edit → 校验 `snapshot.phase === 'ready'`、`roomCode` 匹配、`state.phase === 'lobby'`，否则 throw
- goBack-or-Home：`navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')`
- `ScreenHeader title="<游戏名>设置"`（标题文案本身也不一致：`谁是卧底` / `阿瓦隆设置` / `瞎掰王设置` / `你画我猜`）
- `GameSettingsStepper` + 越界 `showErrorAlert('人数设置有误', ...)`
- footer `共 N 人` + 主按钮 `创建房间` / `保存设置`
- 写法 B 还重复了 `useRoomCreationController` + `useRoomCommandSubmission` + `replaceWithCreatedRoom` / `returnToActiveRoom` 的编排，与 `useRoomConfigSubmission` 等价

### 1.3 配置边界五处真相

以谁是卧底 `numberOfPlayers ∈ [4, 12]`、`hasBlank → ≥ 6` 为例，同一规则出现在：

1. 引擎常量 `UNDERCOVER_MIN_PLAYERS` / `UNDERCOVER_MAX_PLAYERS` / `UNDERCOVER_BLANK_MIN_PLAYERS`
2. 引擎 `isValidUndercoverConfig`（`packages/game-engine/src/games/undercover/state/normalize.ts`）
3. Worker zod `undercoverCreateConfigSchema`（`packages/api-worker/src/games/undercover/schemas.ts`）再写一遍 `.min(UNDERCOVER_MIN_PLAYERS).max(UNDERCOVER_MAX_PLAYERS)`
4. 客户端 hint 文案硬编码 `"支持 4 至 12 人，启用白板至少需要 6 人"`
5. 客户端 `stepCount` 守卫 + alert 文案 `"支持 4 至 12 人"`

改一个边界要动五处；文案与常量没有编译期关联。

### 1.4 控件层已对齐，差距在页面结构

`src/components/GameSettings.tsx`（`GameSettingsStepper` / `GameSettingsSwitch` / `GameSettingsDurationOptions`）+ `gameSettingsStyles` 正是狼人杀 `GameRulesScreen` 在用的控件。与狼人杀的体验差距不在单个控件，而在：

- 没有 header 右上角重置按钮（狼人杀 `configOverflowReset`）
- 没有"记住上次配置"（狼人杀 `SettingsService.getRememberedWerewolfRules`）
- 没有二次确认开关（狼人杀黑死病模式 `confirmOnEnable`）
- 越界反馈用 alert 打断，而非禁用按钮 / 内联提示
- 页面骨架各写各的，新游戏生成器模板（`scripts/lib/new-game/templates/.../__GAME_PASCAL__ConfigScreen.tsx.tmpl`）再复制一份

### 1.5 狼人杀 `GameRulesScreen` 已是描述符驱动

```ts
const RULES: readonly RuleItemConfig[] = [
  { key: 'isSheriffElectionEnabled', label: '首日警长竞选', hint: '...' },
  { key: 'witchCanSelfHeal', label: '女巫可自救', hint: '...' },
  { key: 'isPlagueMode', label: '黑死病模式', hint: '...', accentColor, confirmOnEnable: {...} },
];
```

这个 `RuleItemConfig[]` 就是本设计 `ConfigFieldSpec` 的雏形，只是它活在客户端、仅支持 toggle。

## 2. 目标、非目标与决策

### 目标

1. 配置字段的范围、默认值、跨字段约束只声明一次（引擎），worker 校验与客户端 UI 都从它派生。
2. 非狼人杀游戏的 config screen 由声明生成，游戏只写数据 + 命令，不写页面。
3. 对齐狼人杀的配置体验：重置、记忆、二次确认、内联校验、统一 header/footer。
4. 狼人杀 `GameRulesScreen` 改用同一套表单渲染，删掉手写 map。

### 非目标

- 不给非狼人杀游戏加预设/模板选择步（决策：预设仅狼人杀保留，其它游戏为单页表单）。
- 不动狼人杀角色选择 `ConfigScreen` 与 `BoardPickerScreen`（真正 game-specific 的编辑器，契约里明确要求保留）。
- 不引入 zod / react-hook-form 到 game-engine。引擎零运行时依赖；表单 ≤ 5 字段，表驱动足够。
- 不改变任何游戏的合法配置集合。迁移前后 `isValid<Game>Config` 对同一输入返回相同结果，由现有 contract test 兜底。

### 已确认决策（2026-10-26）

| 决策                                     | 结论                                            |
| ---------------------------------------- | ----------------------------------------------- |
| 引擎层是否引入 schema                    | 是，7 个 `isValid<Game>Config` 改为 schema 驱动 |
| 预设步覆盖范围                           | 仅狼人杀                                        |
| 狼人杀 Rules 页是否切到 `GameConfigForm` | 是                                              |

## 3. 架构总览

```
packages/game-engine/src/platform/config/          ← Layer 1：描述符类型 + validateConfig
packages/game-engine/src/games/<game>/public.ts    ← 每游戏导出 <GAME>_CONFIG_SCHEMA
        │
        ├─► packages/api-worker  configSchemaToZod(schema)  ← create / update 命令边界校验
        │
        └─► src/features/room/config/                      ← Layer 2：GameConfigForm + createGameConfigScreen
                  │
                  ├─► defineClientGameModule({ config: {...} })  ← 7 个非狼人杀游戏
                  │
                  └─► werewolf GameRulesScreen 直接渲染 <GameConfigForm schema={WEREWOLF_RULES_SCHEMA} />
```

## 4. Layer 1 — 引擎：`GameConfigSchema`

### 4.1 类型（已实施）

`packages/game-engine/src/platform/config/configSchema.ts`：

```ts
export interface CountFieldSpec {
  readonly kind: 'count';
  readonly label: string;
  readonly hint?: string;
  readonly min: number;
  readonly max: number;
  readonly isRemembered?: boolean;
}
export interface ToggleFieldSpec {
  readonly kind: 'toggle';
  readonly label: string;
  readonly hint?: string;
  readonly tone?: 'default' | 'warning';
  readonly confirmOnEnable?: {
    readonly title: string;
    readonly message: string;
    readonly confirmText: string;
  };
  readonly isRemembered?: boolean;
}
export interface ChoiceFieldSpec<TValue> {
  readonly kind: 'choice';
  readonly label: string;
  readonly hint?: string;
  readonly options: readonly {
    readonly value: TValue;
    readonly label: string;
    readonly hint?: string;
  }[];
  readonly isRemembered?: boolean;
}
export interface DurationFieldSpec<TValue> {
  readonly kind: 'duration';
  readonly label: string;
  readonly hint?: string;
  readonly values: readonly TValue[];
  readonly nullLabel?: string; // null 选项的显示文案，如 '手动翻页'
  readonly isRemembered?: boolean;
}
/** 不可编辑，但必须出现在 config 里（worker strictObject 需要）。 */
export interface FixedFieldSpec<TValue> {
  readonly kind: 'fixed';
  readonly value: TValue;
}

/** 按值类型决定允许的 kind；非分发条件保证 `number | null` 整体落到 duration。 */
export type ConfigFieldSpec<TValue> =
  | ([TValue] extends [boolean] ? ToggleFieldSpec : never)
  | ([TValue] extends [number] ? CountFieldSpec : never)
  | ([TValue] extends [number | null] ? DurationFieldSpec<TValue> : never)
  | ([TValue] extends [string] ? ChoiceFieldSpec<TValue> : never)
  | FixedFieldSpec<TValue>;

export interface ConfigValidationIssue<TConfig extends object> {
  readonly field: keyof TConfig | null; // null = 整体性问题
  readonly message: string; // 中文，直接展示
}

export interface GameConfigSchema<TConfig extends object> {
  /** 每个 config key 恰好一个 spec；声明顺序即渲染顺序。 */
  readonly fields: { readonly [K in keyof TConfig]-?: ConfigFieldSpec<TConfig[K]> };
  readonly defaults: TConfig;
  /** 跨字段不变量；字段级范围由 validateConfig 自动检查，这里只写字段间关系。 */
  readonly validate: (config: TConfig) => ConfigValidationIssue<TConfig> | null;
}
```

`fields` 是按 key 的映射类型而非数组：漏字段、多字段、kind 与值类型不匹配都是编译错误，不需要运行时覆盖检查。

### 4.2 校验函数（已实施）

```ts
/** 字段级范围（按声明顺序）+ schema.validate，返回第一个问题或 null。 */
export function validateConfig<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
  config: TConfig,
): ConfigValidationIssue<TConfig> | null;

export function isValidConfig<TConfig extends object>(schema, config): boolean;
```

`count` 字段校验 `typeof number` + `Number.isSafeInteger` + 闭区间；`choice` / `duration` 校验值 ∈ options/values；`fixed` 校验全等；`toggle` 校验 `typeof === 'boolean'`。

步 3 再加 `describeCountRange(spec)`（从 min/max 生成 `'支持 4 至 12 人'`），步 1 无消费者不加。

### 4.3 每游戏 schema

| 游戏              | key                            | kind     | 范围 / 选项                                        | 备注                                                                                                                                    |
| ----------------- | ------------------------------ | -------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| demo              | numberOfPlayers                | count    | `DEMO_MIN_PLAYERS`..`DEMO_MAX_PLAYERS`             |                                                                                                                                         |
| fibking           | numberOfPlayers                | count    | `FIB_MIN_PLAYERS`(4)..`FIB_MAX_PLAYERS`(20)        | `FibConfig` 已存在但无 `isValidFibConfig`，`createInitialFibState` 直接调 `isValidFibPlayerCount`；需补 `isValidFibConfig` 并替换该调用 |
| pictionary        | numberOfPlayers                | count    | `PICTIONARY_MIN_PLAYERS`..`PICTIONARY_MAX_PLAYERS` |                                                                                                                                         |
|                   | drawingDurationSeconds         | duration | `PictionaryDrawingDuration` 全部字面量             |                                                                                                                                         |
|                   | guessDurationSeconds           | duration | 同上                                               |                                                                                                                                         |
|                   | transitionDurationSeconds      | duration | 同上                                               |                                                                                                                                         |
|                   | galleryItemDurationSeconds     | duration | 含 `null`，`nullLabel: '手动翻页'`                 |                                                                                                                                         |
| storyrelay        | numberOfPlayers                | count    |                                                    |                                                                                                                                         |
|                   | writingDurationSeconds         | duration | `STORY_RELAY_WRITING_DURATIONS`                    |                                                                                                                                         |
|                   | transitionDurationSeconds      | duration | `STORY_RELAY_TRANSITION_DURATIONS`                 |                                                                                                                                         |
|                   | galleryItemDurationSeconds     | duration | `STORY_RELAY_GALLERY_DURATIONS`，含 `null`         |                                                                                                                                         |
| drawguess         | numberOfPlayers                | count    |                                                    |                                                                                                                                         |
|                   | drawingDurationSeconds 等 4 个 | fixed    | 对应 `DRAWGUESS_*` 常量                            | UI 不渲染；预计时长用 `summary` 展示                                                                                                    |
| avalon            | numberOfPlayers                | count    | 5..10                                              | `AvalonPlayerCount` 为字面量联合，schema 泛型需接受 `number` 子类型                                                                     |
|                   | voteMode                       | choice   | `public` / `secret`                                | 替代当前两颗 `Button` 拼的分段控件                                                                                                      |
|                   | vetoLimit                      | count    | 3..5                                               |                                                                                                                                         |
| undercover        | numberOfPlayers                | count    | 4..12                                              |                                                                                                                                         |
|                   | hasBlank                       | toggle   |                                                    | `validate`：`hasBlank && numberOfPlayers < UNDERCOVER_BLANK_MIN_PLAYERS` → `{ field: 'hasBlank', message: '启用白板至少需要 6 人' }`    |
|                   | category                       | choice   | `'all'` + `UNDERCOVER_CATEGORIES`                  | 客户端用自定义渲染器按词库 inventory 过滤可用项（§6.5）                                                                                 |
| werewolf（rules） | isSheriffElectionEnabled       | toggle   | `isRemembered: true`                               | 来自 `GameRulesScreen.RULES`                                                                                                            |
|                   | witchCanSelfHeal               | toggle   | `isRemembered: true`                               |                                                                                                                                         |
|                   | isPlagueMode                   | toggle   | `tone: 'warning'`, `confirmOnEnable`, 不记忆       |                                                                                                                                         |

狼人杀的 `WEREWOLF_RULES_SCHEMA` 的 `TConfig = Required<GameRuleOverrides>`，`defaults` 全 false。角色列表 `templateRoles` 不进 schema。

### 4.4 `isValid<Game>Config` 的去向

```ts
// 迁移后
export const UNDERCOVER_CONFIG_SCHEMA: GameConfigSchema<UndercoverConfig> = { ... };
export const isValidUndercoverConfig = (config: UndercoverConfig) =>
  isValidConfig(UNDERCOVER_CONFIG_SCHEMA, config);
```

函数名保留，`normalize.ts` 与 worker 调用方不变。现有 contract test 对 `isValid<Game>Config` 的断言全部保留，作为"合法集合不变"的证据。

## 5. Layer 1b — Worker：zod 由 schema 生成

新增 `packages/api-worker/src/platform/room/configSchemaZod.ts`：

```ts
export function configSchemaToZod<TConfig extends object>(
  schema: GameConfigSchema<TConfig>,
): z.ZodType<TConfig>;
```

映射：`count → z.int().min().max()`；`toggle → z.boolean()`；`choice → z.union(literals)`；`duration → z.union(literals | z.null())`；`fixed → z.literal(value)`；外层 `z.strictObject(...).refine((c) => schema.validate(c) === null)`。

7 个手写的 `<game>CreateConfigSchema` 替换为 `configSchemaToZod(<GAME>_CONFIG_SCHEMA)`。`<game>.config.update` 命令的 `config` 字段同样引用它。worker 侧的 `schemas.test.ts` 保留，断言生成的 zod 对边界内外输入的接受/拒绝结果与迁移前一致。

## 6. Layer 2 — 客户端：`src/features/room/config/`

| 文件                            | 职责                                                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameConfigScreenDefinition.ts` | 游戏提供的契约：`schema`、`parseRouteParams`、`readConfig(state) → TConfig \| null`、`buildUpdateCommand`、`getFailureMessage`、`creationLabel`；可选 `buildCreateConfig`、`summary`、`fieldRenderers`、`Extra`、`useSubmitGate(config)`                                         |
| `gameConfigFormModel.ts`        | 纯函数：`parseCountDraft`、`withFieldValue`、`readFieldValue`、`resolveConfigIssue`（草稿不可解析 → 字段级 issue，否则 `validateConfig`）、`toConfigRecord`、`describeDefaultSummary`                                                                                            |
| `useGameConfigScreenState.ts`   | 状态编排：create 初始 = `schema.defaults` ⊕ `SettingsService.getRememberedGameConfig`；edit 初始 = `session.getSnapshot()` → 校验 roomCode → `readConfig`，null 即 `[FAIL-FAST]`；`setFieldValue` 对 `isRemembered` 字段写回偏好；提交走 `useRoomConfigSubmission`               |
| `GameConfigForm.tsx`            | 纯渲染：按 `fields` 声明顺序，count → `GameSettingsStepper`（可输入，min/max 处禁用 +/−）、toggle → `GameSettingsSwitch`（`tone: 'warning'` 取 `colors.warning`，`confirmOnEnable` 走 `showConfirmAlert`）、choice / duration → `GameSettingsChoice`；issue 内联显示在对应字段下 |
| `createGameConfigScreen.tsx`    | 组装 `ScreenHeader(${displayName}设置, 重置)` + `GameScreenContent(form + Extra)` + `GameScreenFooter(summary + 创建房间/保存设置)`；`GameConfigDefiner` 供 `defineClientGameModule` 注入 gameType / displayName                                                                 |

游戏侧注册（[defineClientGameModule](../src/games/model/defineClientGameModule.ts)）：

```ts
config: (define) =>
  define({
    schema: UNDERCOVER_CONFIG_SCHEMA,
    parseRouteParams: parseUndercoverConfigRouteParams,
    readConfig: (state) => (state.phase === 'lobby' ? state.config : null),
    buildUpdateCommand: (config) => ({ type: 'undercover.config.update', config }),
    getFailureMessage: getUndercoverRoomCommandFailureMessage,
    creationLabel: '创建谁是卧底房间',
    summary: (config) => '平民 … · 卧底 … · 白板 …',
    fieldRenderers: { category: UndercoverCategoryField },
    useSubmitGate: useUndercoverConfigSubmitGate,
  }),
```

`define` 回调让 `TConfig` 从 `schema` 推断，游戏不重复写类型参数。

### 6.1 各游戏的逃生口

| 游戏       | 机制                                                    | 内容                                                                         |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| drawguess  | `Extra`                                                 | `DrawGuessConfigEstimate`：每人轮数、总轮数、预计时长（固定时长常量派生）    |
| storyrelay | `summary`                                               | `N 个故事 · 每人 N 棒`                                                       |
| avalon     | `Extra`                                                 | `AvalonBoardPreview`：按人数的固定板子与任务人数；人数越界时不渲染           |
| undercover | `fieldRenderers.category` + `useSubmitGate` + `summary` | 分类按词库 inventory 过滤为可选项；inventory 未就绪 / 所选分类无词时禁用提交 |
| fibking    | `readConfig` 适配                                       | state 直接持有 `numberOfPlayers`，`readConfig` 组装 `{ numberOfPlayers }`    |

### 6.2 记住上次配置

`SettingsService.getRememberedGameConfig(gameType, schema)` 对每个 `isRemembered` 字段返回已存且仍通过 `validateConfigFieldValue` 的值，否则返回 schema 默认值；`setRememberedGameConfigField(gameType, key, value)` 持久化到 `rememberedGameConfigs.<gameType>.<key>`。旧的顶层 `isSheriffElectionEnabled` / `witchCanSelfHeal` 在读取时并入 `rememberedGameConfigs.werewolf`。

### 6.3 行为变化（相对改造前）

- 越界反馈：stepper 到边界即禁用，手输越界在字段下显示 `玩家人数需为 4 至 12 的整数` 并禁用提交；不再弹 alert。
- 单选项的无障碍名统一为选项本身（如 `不限时`），不再带分组标题前缀。
- 谁是卧底的分类选择从居中 modal 改为内联 radio pill。
- 所有游戏 header 右上角新增「重置配置」。

## 7. Layer 3 — 狼人杀

- 引擎 [Template.ts](../packages/game-engine/src/games/werewolf/domain/models/Template.ts) 导出 `WerewolfRules = Required<GameRuleOverrides>` 与 `WEREWOLF_RULES_SCHEMA`（三个 toggle，警长 / 女巫 `isRemembered`，黑死病 `tone: 'warning'` + `confirmOnEnable`）。
- [GameRulesScreen](../src/games/werewolf/screens/GameRulesScreen/GameRulesScreen.tsx) 用 `GameConfigForm` 渲染该 schema，但状态仍是 `GameRuleOverrides`（部分对象）：只有用户设置过的 key 作为 override 提交，缺省 key 保持引擎默认；表单看到的是 `toWerewolfRules(rules)` 解析后的完整视图。
- `useConfigScreenState` 新房间初始规则 = `getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)`。
- 角色选择 `ConfigScreen`、`BoardPickerScreen`、`WerewolfConfigFlowScreen`、`useGameRulesSubmission` 不变。

## 8. testID 规范

[src/testids.ts](../src/testids.ts)：

```ts
gameConfigScreenRoot: (gameType) => `${gameType}-config`,                       // GameScreenContent
gameConfigField: (gameType, key) => `${gameType}-config-field-${key}`,          // 控件 / 自定义渲染器根
gameConfigFieldOption: (gameType, key, value) => `${gameType}-config-field-${key}-${value}`, // null → 'unlimited'
gameConfigFieldIssue: (gameType, key) => `${gameType}-config-issue-${key}`,
gameConfigReset: (gameType) => `${gameType}-config-reset`,
gameConfigSubmit: (gameType) => `${gameType}-config-submit`,
gameRuleSwitch: (rule) => `werewolf-config-field-${rule}`,                       // 别名，狼人杀 rules 页
```

`TESTIDS.configScreenRoot`（`config-screen-root`）仍在 `GameScreen` 根上，与狼人杀 ConfigScreen 一致。

## 9. 迁移计划

每步独立可合并，每步结束跑 `pnpm exec tsc --noEmit` + 对应 workspace 测试；最后一步跑 `pnpm run quality` + `pnpm run e2e`。

| 步   | 内容                                                                                                                                                                                   | DoD                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1 ✅ | 引擎 `platform/config/` 类型 + `validateConfig` + 单测；7 游戏导出 `<GAME>_CONFIG_SCHEMA`，`isValid<Game>Config` 改为委托；`UNDERCOVER_CATEGORY_NAMES` 搬入引擎                        | 引擎 168 个测试文件全绿；`fields` 映射类型在编译期保证覆盖 `keyof TConfig`          |
| 2 ✅ | worker `configSchemaToZod`，替换 7 个 `<game>CreateConfigSchema`                                                                                                                       | worker `schemas.test.ts` 全绿；新增边界内外对照测试                                 |
| 3 ✅ | 客户端 `GameConfigForm` + `GameSettingsChoice` + `useGameConfigScreenState` + `createGameConfigScreen`；demo 切换                                                                      | demo 的 config E2E 通过；Board UI contract test 覆盖 create/edit/reset/内联错误四态 |
| 4 ✅ | pictionary / fibking / storyrelay / drawguess 切换（纯字段 + `summary` / `extra`）                                                                                                     | 各游戏 config E2E 通过；旧 ConfigScreen 文件删除                                    |
| 5 ✅ | avalon（`choice` + `extra: AvalonBoardPreview`）、undercover（`fieldRenderers.category` + `useSubmitGate`）                                                                            | 同上                                                                                |
| 6 ✅ | `SettingsService` 泛化 + 旧键迁移；狼人杀 `GameRulesScreen` 切 `GameConfigForm`                                                                                                        | 狼人杀 config/rules E2E 通过；`rulesHandoff.contract.test.tsx` 通过                 |
| 7 ✅ | 新游戏生成器模板 `__GAME_PASCAL__ConfigScreen.tsx.tmpl` 删除，`module.ts.tmpl` 改为 `config: (define) => define({...})`；`scripts/new-game.test.mjs`、`.agents/skills/new-game` 同步   | `pnpm run sync:agents:check` 通过；生成一个临时游戏跑通 config E2E 后删除           |
| 8 ✅ | 文档：`room-shell-contract.md` §Configuration 改写为 schema 契约；`multigame-platform-design.md` §21.8 / §25 / §28.3 更新；`agents/path-rules/screens.md` 更新；本文件状态改为"已实施" | `docs/README.md` 索引一致；`pnpm run sync:agents:check` 通过                        |

## 10. 风险与处置结果

| 风险                                                          | 处置                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 越界反馈从 alert 改为禁用 + 内联，是可见行为变化              | 已落地；`FibConfigPage.expectIncrementDisabledAtMaximum` 替代原 alert 断言；demo contract test 覆盖 inline issue + submit disabled                                |
| `AvalonPlayerCount` 等字面量联合与 `count` 的 `number` 不兼容 | `ConfigFieldSpec<TValue>` 用 `[TValue] extends [number]` 接受字面量联合；UI 中间态可能持有越界 number，`AvalonBoardPreview` 用 `isAvalonPlayerCount` 守卫后再索引 |
| `RoomCreationRequest.config` 仍是 `Record<string, unknown>`   | 未改；`toConfigRecord(config)` 为默认创建载荷                                                                                                                     |
| fibking state 不持有 `config` 对象                            | 引擎补 `isValidFibConfig` / `DEFAULT_FIB_CONFIG`；客户端 `readConfig` 组装 `{ numberOfPlayers }`                                                                  |
| 记忆存储键迁移                                                | 读取时将顶层旧键并入 `rememberedGameConfigs.werewolf`，嵌套值优先；`SettingsService.test` 覆盖无存储 / 仅旧键 / 新旧并存三种起始状态                              |
| 生成器模板与 demo 漂移                                        | `scripts/new-game.test.mjs` 第 8 条逐字节对比生成的 demo 与仓库 demo，模板在步 2 / 步 3 同步                                                                      |
| 引擎禁止 `as`                                                 | `isConfig` 用类型谓词链（`isRecord` → `hasValidFields`）完成 unknown → `TConfig` 收窄，架构契约测试通过                                                           |

## 11. 文件清单（实际落地）

### 新增

- `packages/game-engine/src/platform/config/configSchema.ts` + `__tests__/configSchema.test.ts`
- `packages/api-worker/src/platform/room/configSchemaZod.ts` + `__tests__/configSchemaZod.test.ts`
- `src/features/room/config/{GameConfigScreenDefinition,gameConfigFormModel,useGameConfigScreenState}.ts`、`{GameConfigForm,createGameConfigScreen}.tsx`、`__tests__/gameConfigFormModel.test.ts`
- `src/games/demo/screens/__tests__/demoConfigScreen.contract.test.tsx`
- `src/games/drawguess/screens/DrawGuessConfigEstimate.tsx`
- `src/games/avalon/screens/AvalonBoardPreview.tsx`
- `src/games/undercover/screens/UndercoverCategoryField.tsx`

### 修改

- 7 个 `packages/game-engine/src/games/<game>/state/types.ts`（+ undercover `normalize.ts`、fibking `engine.ts`）与 `public.ts`；`werewolf/domain/models/Template.ts`
- `packages/game-engine/package.json` exports、`platform/__tests__/architecture.contract.test.ts`
- 7 个 `packages/api-worker/src/games/<game>/schemas.ts`
- `src/games/model/defineClientGameModule.ts`（`ConfigScreen` → `config: (define) => …`）
- 7 个 `src/games/<game>/module.ts`
- `src/games/werewolf/screens/GameRulesScreen/GameRulesScreen.tsx`、`ConfigScreen/useConfigScreenState.ts`
- `src/features/settings/services/SettingsService.ts`
- `src/components/GameSettings.tsx`（`isIncrementDisabled`、`GameSettingsChoice`、`formatDurationOption`）、`GameSettings.styles.ts`（`issue`）
- `src/testids.ts`、`jest.setup.ts`、`e2e/pages/{Fib,Pictionary}ConfigPage.ts`、`e2e/specs/{avalon,undercover,drawguess,storyrelay,fibking,fibking-responsive,werewolf-config,room-narration}.spec.ts`
- `scripts/lib/new-game/templates/**`（engine `types.ts` / `public.ts`、worker `schemas.ts`、client `module.ts`）、`scripts/new-game.test.mjs`、`.agents/skills/new-game/SKILL.md`
- `docs/room-shell-contract.md`、`docs/multigame-platform-design.md`、`agents/path-rules/screens.md`、`docs/README.md`

### 删除

- `src/games/{avalon,demo,drawguess,undercover,storyrelay}/screens/*ConfigScreen.tsx`
- `src/games/fibking/screens/ConfigScreen/`、`src/games/pictionary/screens/ConfigScreen/`
- `src/games/{fibking,pictionary}/navigation/types.ts`（无引用）
- `GameSettingsDurationOptions`、`isAvalonVoteMode`、`isValidPictionaryPlayerCount`
- `scripts/lib/new-game/templates/shared/src/games/__GAME_ID__/screens/__GAME_PASCAL__ConfigScreen.tsx.tmpl`

## 12. 开放问题（已关闭）

1. `confirmOnEnable` 等中文文案归属：放在引擎 schema，与 `ROLE_SPECS.displayName` 同策略。已按此实施。
2. `choice` 的呈现：统一用 `GameSettingsChoice` radio pill（阿瓦隆 2 项、卧底 11 项均可换行排布），不再区分分段 / 单选行，不加 `presentation` 字段。

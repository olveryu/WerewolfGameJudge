# 游戏配置 Schema 驱动设计

> 状态：实施中。步 1（引擎 schema）已完成；决策记录见 §2，实施顺序见 §9。
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

## 6. Layer 2 — 客户端：`GameConfigForm` 与 `createGameConfigScreen`

目录：`src/features/room/config/`。

### 6.1 `GameConfigForm`（纯渲染）

```ts
interface GameConfigFormProps<TConfig extends object> {
  readonly schema: GameConfigSchema<TConfig>;
  readonly value: TConfig;
  readonly onChange: (next: TConfig) => void;
  readonly issue: ConfigValidationIssue<TConfig> | null; // 内联显示在对应字段下
  readonly fieldRenderers?: Partial<Record<keyof TConfig, ConfigFieldRenderer<TConfig>>>;
  readonly testIDPrefix: string; // 见 §8
}
```

字段 → 控件映射（全部复用现有组件）：

| kind     | 控件                                                                                                 | 行为变化                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| count    | `GameSettingsStepper`（可输入）                                                                      | 到达 min/max 时禁用对应按钮（`isDecrementDisabled` 已有，补 `isIncrementDisabled`）；手输越界显示内联错误并禁用提交，**不再弹 alert** |
| toggle   | `GameSettingsSwitch`                                                                                 | `tone: 'warning'` → `accentColor: colors.warning`；`confirmOnEnable` → `showConfirmAlert`（沿用 `GameRulesScreen.handleToggle`）      |
| choice   | 新增 `GameSettingsChoice`（分段，≤ 3 项）/ 复用 `GameSettingsDurationOptions` 的单选行样式（> 3 项） | 替代 avalon 两颗 `Button`、undercover 自写的 `BaseCenterModal` 列表                                                                   |
| duration | `GameSettingsDurationOptions`                                                                        | 不变                                                                                                                                  |
| fixed    | 不渲染                                                                                               |                                                                                                                                       |

hint 文案：`count` 用 `describeCountRange(spec)` 生成，`spec.hint` 作为追加句。

### 6.2 `createGameConfigScreen(definition)`

```ts
interface GameConfigScreenDefinition<TGameType, TState, TCommand, TConfig> {
  readonly schema: GameConfigSchema<TConfig>;
  readonly readConfig: (state: TState) => TConfig;                 // edit 模式从 snapshot 取
  readonly buildUpdateCommand: (config: TConfig) => TCommand;      // 如 { type: 'undercover.config.update', config }
  readonly buildCreateConfig?: (config: TConfig) => Record<string, unknown>;  // 默认 identity
  readonly getFailureMessage: (result: RoomCommandDispatchOutcome<TState>) => string;
  readonly summary?: (config: TConfig) => string;                  // footer，默认 `共 ${numberOfPlayers} 人`
  readonly fieldRenderers?: ...;
  readonly extra?: React.ComponentType<{ readonly config: TConfig }>;  // 表单下方插槽（阿瓦隆板子预览、你画我猜预计时长）
  readonly isSubmitReady?: () => { readonly ready: boolean; readonly message?: string };  // 异步前置（词库 inventory）
}
```

返回 `React.ComponentType<{ readonly session: RoomSessionClient<TState, TCommand> }>`，即现在 `defineClientGameModule.ConfigScreen` 的签名。`defineClientGameModule` 新增 `config` 字段，内部调用工厂；原 `ConfigScreen` 字段删除。

页面结构（对齐狼人杀）：

```
ScreenHeader
  title   = home.mode.displayName          ← 统一取自 GameHomeContribution，不再各写各的
  onBack  = goBack-or-Home
  right   = 重置 icon（trash-outline）：create → schema.defaults；edit → 重新读 snapshot
GameScreenContent
  <GameConfigForm ... />
  <definition.extra config={config} />
GameScreenFooter
  summary(config)
  Button primary lg：create → '创建房间'；edit → '保存设置'；disabled = issue !== null || !ready
```

### 6.3 `useGameConfigScreenState`

统一的状态编排，取代 7 份 `readInitialConfig` + 提交代码：

初始配置优先级（create）：`rememberedConfig(gameType)` 覆盖 `schema.defaults`。
初始配置（edit）：`session.getSnapshot()` → 校验 `phase === 'ready'` && `roomCode` 匹配 && `state.phase === 'lobby'`，否则 `throw new Error('[FAIL-FAST] ...')`（沿用现有行为）→ `definition.readConfig(state)`。

提交：`useRoomConfigSubmission`（已有），`createRequest = () => ({ expectedHostUserId: user.id, gameType, config: buildCreateConfig(config) })`，`updateConfig = () => session.dispatch(buildUpdateCommand(config), { controlledSeat: null, label: '保存设置' })`。

路由解析：`createStandardConfigRouteParser({ gameType, displayName })`（已有）。每游戏现有的 `parse<Game>ConfigRouteParams` 保留在各自 `navigation/` 下，由工厂接收。

### 6.4 记住上次配置

`SettingsService` 泛化：

```ts
getRememberedGameConfig<TConfig>(gameType: GameType, schema: GameConfigSchema<TConfig>): Partial<TConfig>;
setRememberedGameConfigField<TConfig, K extends keyof TConfig>(gameType, key: K, value: TConfig[K]): Promise<void>;
```

只持久化 `isRemembered: true` 的字段，存储键 `rememberedConfig.<gameType>.<key>`。现有 `getRememberedWerewolfRules` / `setRememberedWerewolfRule` 改为该接口的狼人杀特化并做一次存储键迁移（旧键 → 新键，读到旧键即搬迁）。写失败沿用 `GameRulesScreen.applyRule` 的回滚 + `handleError(isExpectedStorageError)`。

### 6.5 逃生口：自定义字段渲染器

```ts
type ConfigFieldRenderer<TConfig> = React.ComponentType<{
  readonly field: ConfigFieldSpec<TConfig>;
  readonly value: TConfig[keyof TConfig];
  readonly onChange: (value: TConfig[keyof TConfig]) => void;
  readonly issue: ConfigValidationIssue<TConfig> | null;
}>;
```

谁是卧底 `category`：`UndercoverCategoryField` 内部 `useQuery(undercoverInventoryOptions)`，用 schema 的 `options` 做全集、inventory 做可用集；inventory 未就绪或为空时通过 `isSubmitReady` 阻止提交（文案沿用 `'分类尚未就绪'` / `'暂无可用词语'`）。渲染器用 `GameSettingsChoice` 的单选行样式，不再自写 modal。

## 7. Layer 3 — 狼人杀

- `GameRulesScreen`：删除 `RULES` 常量与手写 map，改为 `<GameConfigForm schema={WEREWOLF_RULES_SCHEMA} value={rules} onChange={setRules} ... />`。`applyRule` 的记忆写入改走 §6.4 接口；`isRememberedWerewolfRuleKey` 由 schema `isRemembered` 取代。
- `useGameRulesSubmission`、`ConfigScreen`、`BoardPickerScreen`、`WerewolfConfigFlowScreen` 不动。
- `RootStackParamList['GameConfig']` 与 `WerewolfConfigStackParamList` 不动。

## 8. testID 规范

新增到 `src/testids.ts`：

```ts
gameConfigScreenRoot: (gameType: string) => `${gameType}-config-screen-root`,
gameConfigField: (gameType: string, key: string) => `${gameType}-config-field-${key}`,
gameConfigFieldOption: (gameType: string, key: string, value: string) => `${gameType}-config-field-${key}-${value}`,
gameConfigReset: (gameType: string) => `${gameType}-config-reset`,
gameConfigSubmit: (gameType: string) => `${gameType}-config-submit`,
```

迁移现有：`fibConfigSubmitButton`、`pictionaryConfigPlayerCount`、`pictionaryConfigDurationOption`、`pictionaryConfigSubmitButton`、裸字符串 `'undercover-player-count'`。狼人杀 `gameRuleSwitch(key)` 保留别名指向 `gameConfigField('werewolf', key)`，E2E spec 同步改。

## 9. 迁移计划

每步独立可合并，每步结束跑 `pnpm exec tsc --noEmit` + 对应 workspace 测试；最后一步跑 `pnpm run quality` + `pnpm run e2e`。

| 步   | 内容                                                                                                                                                             | DoD                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1 ✅ | 引擎 `platform/config/` 类型 + `validateConfig` + 单测；7 游戏导出 `<GAME>_CONFIG_SCHEMA`，`isValid<Game>Config` 改为委托；`UNDERCOVER_CATEGORY_NAMES` 搬入引擎  | 引擎 168 个测试文件全绿；`fields` 映射类型在编译期保证覆盖 `keyof TConfig`          |
| 2    | worker `configSchemaToZod`，替换 7 个 `<game>CreateConfigSchema`                                                                                                 | worker `schemas.test.ts` 全绿；新增边界内外对照测试                                 |
| 3    | 客户端 `GameConfigForm` + `GameSettingsChoice` + `useGameConfigScreenState` + `createGameConfigScreen`；demo 切换                                                | demo 的 config E2E 通过；Board UI contract test 覆盖 create/edit/reset/内联错误四态 |
| 4    | pictionary / fibking / storyrelay / drawguess 切换（纯字段 + `summary` / `extra`）                                                                               | 各游戏 config E2E 通过；旧 ConfigScreen 文件删除                                    |
| 5    | avalon（`choice` + `extra: AvalonBoardPreview`）、undercover（`fieldRenderers.category` + `isSubmitReady`）                                                      | 同上                                                                                |
| 6    | `SettingsService` 泛化 + 旧键迁移；狼人杀 `GameRulesScreen` 切 `GameConfigForm`                                                                                  | 狼人杀 config/rules E2E 通过；`rulesHandoff.contract.test.tsx` 通过                 |
| 7    | 新游戏生成器模板 `__GAME_PASCAL__ConfigScreen.tsx.tmpl` 删除，`module.ts.tmpl` 改为 `config: {...}`；`scripts/new-game.test.mjs`、`.agents/skills/new-game` 同步 | `pnpm run sync:agents:check` 通过；生成一个临时游戏跑通 config E2E 后删除           |
| 8    | 文档：`room-shell-contract.md` §Configuration 改写为 schema 契约；`multigame-platform-design.md` §25 接入清单更新；本文件状态改为"已实施"                        | `docs/README.md` 索引一致                                                           |

## 10. 风险与应对

| 风险                                                          | 应对                                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 越界反馈从 alert 改为禁用 + 内联，是可见行为变化              | 列入步 3 验收截图；E2E 中依赖 alert 文案的断言改为断言 submit disabled + 内联文案                                                                                                                                                               |
| `AvalonPlayerCount` 等字面量联合与 `count` 的 `number` 不兼容 | `count` 的 key 约束为 `TConfig[K] extends number`；`onChange` 处由 `validateConfig` 保证值 ∈ [min,max]，类型层用 `as AvalonPlayerCount` 以外的方式：在 avalon schema 上提供 `coerce: (n: number) => AvalonPlayerCount` 的窄化函数，失败即 issue |
| `RoomCreationRequest.config` 仍是 `Record<string, unknown>`   | 本设计不改；`buildCreateConfig` 默认 identity，类型收紧留作后续                                                                                                                                                                                 |
| fibking state 不持有 `config` 对象                            | 引擎补 `isValidFibConfig`；客户端 `readConfig: (state) => ({ numberOfPlayers: state.numberOfPlayers })`                                                                                                                                         |
| 记忆存储键迁移                                                | 读旧键 → 写新键 → 删旧键，单测覆盖三种起始状态                                                                                                                                                                                                  |
| 生成器模板与 skill 漂移                                       | 步 7 单独一步，`sync:agents:check` 为门禁                                                                                                                                                                                                       |

## 11. 文件清单

### 新增

- `packages/game-engine/src/platform/config/configSchema.ts`、`validateConfig.ts`、`__tests__/`
- `packages/api-worker/src/platform/room/configSchemaZod.ts` + 测试
- `src/features/room/config/GameConfigForm.tsx`、`useGameConfigScreenState.ts`、`createGameConfigScreen.tsx`、`ConfigFieldRenderer.ts`、`__tests__/`
- `src/components/GameSettingsChoice.tsx`
- `src/games/undercover/screens/UndercoverCategoryField.tsx`
- `src/games/avalon/screens/AvalonBoardPreview.tsx`（从现有 ConfigScreen 拆出）

### 修改

- 7 个 `packages/game-engine/src/games/<game>/state/types.ts|normalize.ts` + `public.ts`
- 7 个 `packages/api-worker/src/games/<game>/schemas.ts`
- `src/games/model/defineClientGameModule.ts`（`ConfigScreen` → `config`）
- 7 个 `src/games/<game>/module.ts`
- `src/games/werewolf/screens/GameRulesScreen/GameRulesScreen.tsx`
- `src/features/settings/services/SettingsService.ts`
- `src/components/GameSettings.tsx`（`isIncrementDisabled`）
- `src/testids.ts`、相关 `e2e/**`
- `scripts/lib/new-game/templates/**`、`scripts/new-game.test.mjs`、`.agents/skills/new-game/**`
- `docs/room-shell-contract.md`、`docs/multigame-platform-design.md`、`docs/README.md`

### 删除

- `src/games/{avalon,demo,drawguess,undercover,storyrelay}/screens/*ConfigScreen.tsx`
- `src/games/fibking/screens/ConfigScreen/`、`src/games/pictionary/screens/ConfigScreen/`
- `scripts/lib/new-game/templates/shared/src/games/__GAME_ID__/screens/__GAME_PASCAL__ConfigScreen.tsx.tmpl`

## 12. 开放问题

1. `confirmOnEnable` 的中文文案放在引擎 schema 里（与 `ROLE_SPECS.displayName` 同策略）还是客户端覆盖表？本设计选引擎，与现有角色文案归属一致。
2. `choice` 分段控件的阈值（≤ 3 项用分段、> 3 项用单选行）是否需要显式 `presentation` 字段而不是按数量推断？实施步 3 时按阿瓦隆（2 项）与卧底（≥ 6 项）两个实例验证后定。

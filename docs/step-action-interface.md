# 步骤机制接口设计

状态：**助手的提议，用户尚未确认。** 本文是 [step-action-redesign.md](step-action-redesign.md) §7“平台层步骤机制的具体接口”的展开，供实现开工时使用。每一节末尾标出它落实的是哪条已确认的决定；没有标注出处的部分是助手自己的设计选择。

类型草图只表达形状，名字和字段可以在实现时调整；调整了决定所约束的行为则需要先回到设计文档。

## 1. 位置和依赖方向

| 部分                       | 位置                                                        | 说明                                   |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| 步骤机制（引擎）           | `packages/game-engine/src/platform/steps/`                  | 纯函数，对游戏状态泛型，不引用任何游戏 |
| 狼人杀角色文件             | `packages/game-engine/src/games/werewolf/roles/<roleId>.ts` | 一个角色一个文件                       |
| 狼人杀步骤顺序             | 保留一张集中的顺序表                                        | 行为不变（D24）                        |
| 阿瓦隆、秘密希特勒夜间步骤 | 各自游戏目录下                                              | 只用“查看信息”                         |
| 步骤渲染（客户端）         | `packages/web/src/features/room/steps/`                     | 通用渲染，不认识角色                   |

依赖方向沿用现有边界测试：平台不引用游戏，游戏之间不互相引用，引擎无 React 和网络依赖。出处：D26、§6.2 第 10 点。

## 2. 文案表

```ts
// platform/steps/copy.ts
/** 中文只允许出现在 defineCopy 的参数里。模板占位符：{seat} {seats} {role} {name} {count}。 */
export function defineCopy<const T extends Readonly<Record<string, string>>>(table: T): T;

export type CopyParams = Readonly<Record<string, string | number>>;
export function renderCopy(template: string, params?: CopyParams): string;
```

- 每个角色文件顶部一张 `const COPY = defineCopy({...})`；平台层有一张公共表（取消、确定、查看、知道了、不用技能、生成引导句用的句式、“未{name}”、通用拒绝提示）。
- 检查用 TypeScript AST 实现，和现有架构契约测试同一做法：在引擎的狼人杀目录、平台步骤目录、客户端步骤渲染目录和狼人杀房间夜间代码里，含中文的字符串字面量只能位于 `defineCopy(...)` 的参数内。这样“一个角色一个文件”和“文案表之外不许有中文”可以同时成立，不需要把文案拆到另一个文件。
- 座位号格式化继续用平台已有的 `formatSeat`。

出处：D8、D21（新检查之一）。

## 3. 四种动作的声明

```ts
// platform/steps/actions.ts
interface ActionBase<TContext> {
  readonly key: string;
  /** 动作名：手牌文字，也是引导句、弹窗、复盘的词根。 */
  readonly name: string;
  /** 手牌是否可用；不可用时返回原因文案。省略表示总是可用。 */
  readonly availability?: (context: TContext) => Availability;
  /** 被步骤锁住时（见 §4 的 lock）是否仍然可用。默认 false。 */
  readonly staysWhenLocked?: boolean;
  /** final：提交后该座位本步完成。revisable：步骤关闭前可以改或撤回（狼人投票）。默认 final。 */
  readonly commit?: 'final' | 'revisable';
}

export type Availability =
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'hidden' };

export interface PickSeatsAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'pickSeats';
  readonly count: { readonly min: number; readonly max: number };
  /** 每个在座座位是否可选；不可选时给原因。只能使用行动者有权知道的信息（D32）。 */
  readonly seats: (context: TContext) => readonly SeatOption[];
  /** “动作 + 对象”那句话，弹窗标题和复盘共用。省略时用默认的“{name}{seats}”。 */
  readonly phrase?: (seats: readonly number[]) => string;
  /** 引导句第一行。省略时按人数从 name 生成。 */
  readonly prompt?: string;
  /** 弹窗正文：只写额外后果，没有就返回 null。 */
  readonly consequence?: (context: TContext, seats: readonly number[]) => string | null;
  readonly resolve: (context: TContext, seats: readonly number[]) => Resolution<TFacts, TResult>;
}

export interface SeatOption {
  readonly seat: number;
  readonly unavailableReason: string | null;
}

export interface DirectAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'direct';
  /** 已知对象：手牌显示为 phrase(target)。没有对象时省略。 */
  readonly target?: (context: TContext) => number | null;
  readonly phrase?: (seat: number) => string;
  readonly consequence?: (context: TContext) => string | null;
  readonly tone?: 'default' | 'danger';
  readonly resolve: (context: TContext) => Resolution<TFacts, TResult>;
}

export interface ViewAction<TContext> extends ActionBase<TContext> {
  readonly kind: 'view';
  /** 内容弹窗的标题；手牌文字 = “查看” + title。 */
  readonly title: string;
  readonly content: (context: TContext) => string;
}

export interface PickCardAction<TContext, TFacts, TResult> extends ActionBase<TContext> {
  readonly kind: 'pickCard';
  readonly cards: (context: TContext) => readonly CardOption[];
  readonly hint?: (context: TContext) => string | null;
  readonly phrase: (card: CardOption) => string;
  readonly resolve: (context: TContext, cardIndex: number) => Resolution<TFacts, TResult>;
}

export interface CardOption {
  readonly index: number;
  readonly label: string;
  readonly unavailableReason: string | null;
}

/** 提交后写入的事实，以及给行动者的私密结果。结果存代码，不存显示文字。 */
export interface Resolution<TFacts, TResult> {
  readonly facts?: Partial<TFacts>;
  readonly result?: TResult;
}
```

要点：

- `seats`、`availability`、`cards` 既用来生成界面，也用来校验提交（§6）。没有单独的校验函数，也没有单独的拒绝文案。
- “不用技能”不由角色声明。步骤声明 `skippable`，平台自动加这张手牌和引导句第二行。
- 查看信息的“取消／查看”先问弹窗只在客户端，不提交、不登记；点“知道了”才是一次提交。这与既有规则“取消不亮内容、不登记”一致。

出处：D14、D15、D17、D18、D19、D20、D32，停点 1 的 A11、A12。

## 4. 步骤的声明

```ts
// platform/steps/step.ts
export interface StepDefinition<TStepId extends string, TContext, TFacts, TResult> {
  readonly id: TStepId;
  /** 状态栏的步骤标题。 */
  readonly title: string;
  /** 开始和结束播报；null 表示不播。可以依赖状态（如预言家标签、阿瓦隆有无奥伯伦）。 */
  readonly audio: (context: TContext) => {
    readonly begin: string | null;
    readonly end: string | null;
  };
  /** 本步需要行动的座位。空数组表示空步骤（见下）。 */
  readonly actors: (context: TContext) => readonly number[];
  readonly actions: readonly StepAction<TContext, TFacts, TResult>[];
  /** 是否可以不用技能。必须行动的步骤返回 false。 */
  readonly skippable: (context: TContext) => boolean;
  /** 步骤被锁住的原因（被恐惧、当夜无法袭击）。非 null 时除 staysWhenLocked 的动作外都不可用，并强制提供“不用技能”。 */
  readonly lock?: (context: TContext) => string | null;
  /** 规则或情况提示，各占一行，排在生成的引导句之后。 */
  readonly hints?: (context: TContext) => readonly string[];
  /** 私密结果的显示（查验结果等）。 */
  readonly renderResult?: (
    context: TContext,
    result: TResult,
  ) => { readonly title: string; readonly text: string };
  /** 复盘句子里由角色补充的结果或备注，如“结果：好人”“（技能无效）”。 */
  readonly reviewSuffix?: (context: TContext, entry: SeatSubmission) => string | null;
  /** 覆盖默认的“该座位本步是否完成”。只有机械狼学到猎人后的技能状态需要。 */
  readonly isSeatSettled?: (context: TContext, record: SeatRecord<TResult>) => boolean;
  /** 覆盖默认的“步骤是否完成”。只有狼人投票需要（全员投完后的倒计时）。 */
  readonly completion?: (context: TContext) => StepCompletion;
}

export type StepCompletion =
  | { readonly kind: 'pending' }
  | { readonly kind: 'complete' }
  | { readonly kind: 'armCountdown' }
  | { readonly kind: 'waitUntil'; readonly deadlineMs: number };
```

`TContext` 由游戏定义，平台只要求它带上公共部分：

```ts
export interface StepContextBase<TState, TFacts, TResult> {
  readonly state: TState;
  readonly facts: TFacts;
  /** 正在看界面或提交的座位；计算步骤级内容时为 null。 */
  readonly seat: number | null;
  readonly record: StepRecord<TResult>;
}
```

默认规则（不写覆盖时）：

- 一个座位完成 = 有一条 final 提交，并且没有未确认的私密结果。
- 步骤完成 = `actors` 里每个座位都完成，并且没有播报在播。
- 空步骤（`actors` 为空，例如角色在底牌里）：照常播报，等待一个随机时长后推进。这是现有行为，随机范围沿用现值，由游戏通过 `completion` 返回 `waitUntil` 表达。

两个已知的非默认情况，接口都能容纳：

- **狼人投票**：`pickSeats` 的 `commit: 'revisable'`；“撤回袭击投票”是一个 `direct` 动作，`availability` 读记录判断是否已投；“放弃袭击”是 `direct` 且 `staysWhenLocked`；`completion` 在全员投完时返回 `armCountdown`，沿用平台已有的 `decideSettleCountdownArm`。
- **机械狼学到猎人**：学习结果确认后，同一步内再出现“查看技能状态”这个 `view` 动作（`availability` 读记录），`isSeatSettled` 要求它也完成。

出处：D14、D16（时机在客户端，见 §8）、D19、D24（播报和空步骤行为不变），停点 1 的 A11、A15、A16。

## 5. 状态

每个使用步骤机制的游戏在自己的状态里放一份：

```ts
// platform/steps/state.ts
export interface StepSlice<TStepId extends string, TResult> {
  /** 本夜实际要走的步骤，开夜时按板子从集中顺序表筛出。 */
  readonly order: readonly TStepId[];
  /** 当前步骤；null 表示已走完。serial 每推进一步加一，用来识别过期提交。 */
  readonly current: { readonly stepId: TStepId; readonly serial: number } | null;
  readonly records: Readonly<Partial<Record<TStepId, StepRecord<TResult>>>>;
  /** 狼人投票倒计时或空步骤等待的截止时间。 */
  readonly deadlineMs: number | null;
}

export interface StepRecord<TResult> {
  readonly bySeat: Readonly<Record<string, SeatRecord<TResult>>>;
}

export interface SeatRecord<TResult> {
  /** 按时间排列。revisable 的动作重投时替换同 key 的那条。 */
  readonly submissions: readonly SeatSubmission[];
  readonly result: TResult | null;
  readonly isResultAcknowledged: boolean;
}

export interface SeatSubmission {
  readonly actionKey: string;
  readonly seats: readonly number[];
  readonly cardIndex: number | null;
}
```

夜间事实（守护了谁、毒了谁等）继续是游戏自己的一份语义槽位，不放进平台结构。播报队列继续用平台已有的 `AudioQueueSlice`。

这份结构取代狼人杀现有的按步骤专属字段：8 个查验结果字段、5 个确认名单、`witchContext`、`confirmStatus`、`actionRejected`、`ui.currentActorHint`、`pendingRevealAcks`、`wolfRobotHunterStatusViewed` 等。状态没有版本号和迁移，进行中的旧房间会被丢弃，这是仓库既有规则。

出处：D1、§6.2 第 5 点。

## 6. 引擎侧运行接口

```ts
// platform/steps/runtime.ts
export interface StepRuntime<TStepId extends string, TState, TContext, TFacts, TResult> {
  readonly definitions: Readonly<
    Record<TStepId, StepDefinition<TStepId, TContext, TFacts, TResult>>
  >;
  readonly getSlice: (state: TState) => StepSlice<TStepId, TResult>;
  readonly getFacts: (state: TState) => TFacts;
  readonly createContext: (state: TState, seat: number | null) => TContext;
  readonly isAudioPlaying: (state: TState) => boolean;
  readonly seatedSeats: (state: TState) => readonly number[];
}

/** 客户端发来的提交。 */
export interface StepSubmission {
  readonly stepId: string;
  readonly serial: number;
  readonly actionKey: string;
  readonly seats?: readonly number[];
  readonly cardIndex?: number;
}

export type StepEvent<TStepId extends string, TFacts, TResult> =
  | {
      readonly type: 'submitted';
      readonly stepId: TStepId;
      readonly seat: number;
      readonly submission: SeatSubmission;
      readonly facts: Partial<TFacts>;
      readonly result: TResult | null;
    }
  | {
      readonly type: 'withdrawn';
      readonly stepId: TStepId;
      readonly seat: number;
      readonly actionKey: string;
    }
  | { readonly type: 'resultAcknowledged'; readonly stepId: TStepId; readonly seat: number }
  | { readonly type: 'deadlineArmed'; readonly deadlineMs: number }
  | {
      readonly type: 'advanced';
      readonly next: TStepId | null;
      readonly audio: readonly AudioEffect[];
    };

export const REASON_STEP_STALE: string;

/** 界面内容。纯数据，可以做快照。 */
export function presentStep(runtime, state, viewerSeat): StepPresentation | null;

/** 某次具体选择的确认弹窗内容。客户端在弹窗前调用。 */
export function describeStepConfirmation(
  runtime,
  state,
  viewerSeat,
  selection: Pick<StepSubmission, 'actionKey' | 'seats' | 'cardIndex'>,
): { readonly title: string; readonly body: string | null; readonly tone: 'default' | 'danger' };

/** 校验并产出事件。校验 = 提交必须是 presentStep 此刻会提供的选项，否则 REASON_STEP_STALE。 */
export function decideStepSubmission(
  runtime,
  state,
  actorSeat: number,
  submission: StepSubmission,
):
  | { readonly kind: 'reject'; readonly reason: string }
  | { readonly kind: 'accept'; readonly events: readonly StepEvent[] };

/** 提交之后、播报确认之后、截止时间到达时调用：是否该推进，推进时带出结束和开始播报。 */
export function evaluateStepProgress(runtime, state, nowMs: number): readonly StepEvent[];

export function evolveStepSlice(slice, event): StepSlice;

/** 房主“标记机器人已确认”：给还没确认的机器人座位补上查看类提交。 */
export function planBotAcknowledgements(
  runtime,
  state,
  botSeats: readonly number[],
): readonly StepEvent[];

/** 复盘：每步每个行动者一行。行动了是“主语 + phrase”，没行动是“未 + name”，后缀来自 reviewSuffix。 */
export function buildStepReviewLines(runtime, state): readonly StepReviewLine[];
```

`presentStep` 的输出：

```ts
export interface StepPresentation {
  readonly stepId: string;
  readonly serial: number;
  readonly title: string;
  /** 引导句：生成的第一行、可跳过时的第二行、角色的提示行。非行动者为空。 */
  readonly lines: readonly string[];
  readonly actions: readonly PresentedAction[];
  /** 提交后自动出现、需要点“知道了”的私密结果。 */
  readonly pendingResult: { readonly title: string; readonly text: string } | null;
  /** 进度，如全员确认的 3/8、狼人投票的 2/3。 */
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly deadlineMs: number | null;
}

export type PresentedAction =
  | {
      readonly kind: 'pickSeats';
      readonly key: string;
      readonly label: string;
      readonly availability: Availability;
      readonly min: number;
      readonly max: number;
      readonly seats: readonly SeatOption[];
      /** 已提交过的选择（狼人已投的票）。 */
      readonly committed: readonly number[] | null;
    }
  | {
      readonly kind: 'direct';
      readonly key: string;
      readonly label: string;
      readonly availability: Availability;
    }
  | {
      readonly kind: 'view';
      readonly key: string;
      readonly label: string;
      readonly availability: Availability;
      readonly content: { readonly title: string; readonly text: string };
      readonly isAcknowledged: boolean;
    }
  | {
      readonly kind: 'pickCard';
      readonly key: string;
      readonly label: string;
      readonly availability: Availability;
      readonly cards: readonly CardOption[];
      readonly hint: string | null;
    };
```

各游戏的接法：

- 命令：每个游戏一条 `<game>.step.submit`，载荷是 `StepSubmission`。狼人杀现有的 `werewolf.action.submit`、`werewolf.reveal.ack`、`werewolf.groupConfirm.ack`、`werewolf.wolfRobot.ackHunterStatus` 合并为它；阿瓦隆的 `avalon.night.confirm`、秘密希特勒的 `secrethitler.night.confirm` 换成它。房主的“标记机器人已确认”命令（`werewolf.groupConfirm.ackBots`、`avalon.bots.markAllBotsGroupConfirmed`、`secrethitler.bots.markAllBotsGroupConfirmed`）保留，内部调用 `planBotAcknowledgements`。
- 事件：游戏把 `StepEvent` 包进自己的事件类型，`evolve` 里交给 `evolveStepSlice`，并把 `facts` 合并进自己的夜间事实。
- 行动座位：由游戏用平台已有的 `resolveActingSeat` 解析（含房主接管机器人）后传入。
- 视图：各游戏的 `get<Game>ViewModel` 增加一个 `step: StepPresentation | null` 字段，取代狼人杀现在的 `night` 里那十几个字段。
- 提交后被拒绝只有 `REASON_STEP_STALE` 一个原因码，客户端对应停点 1 的 A17 那一句。

出处：D3、D20、D23、D26，停点 1 的 A17。

## 7. 一个角色文件的样子

以女巫为例，只为说明形状，措辞以停点 1 的结论为准：

```ts
const COPY = defineCopy({
  useAntidote: '用解药',
  useAntidoteOn: '对{seat}用解药',
  poison: '毒杀',
  attacked: '{seat}被狼人袭击',
  selfAttacked: '你被狼人袭击',
  peacefulNight: '昨夜平安夜',
  selfSaveDisallowed: '本局规则不允许自救',
});

export const witch = defineRole({
  id: 'witch',
  card: { /* 角色名、技能描述、标签：卡面和图鉴用 */ },
  traits: { faction: Faction.God, team: Team.Good },
  steps: [
    {
      id: 'witchAction',
      title: /* 来自公共句式 */,
      audio: () => ({ begin: 'witch', end: 'witch' }),
      actors: (context) => seatsOfRole(context, 'witch'),
      skippable: () => true,
      hints: (context) =>
        context.facts.wolfKillTarget === null
          ? [COPY.peacefulNight]
          : context.facts.wolfKillTarget === context.seat
            ? [COPY.selfAttacked]
            : [renderCopy(COPY.attacked, { seat: formatSeat(context.facts.wolfKillTarget) })],
      actions: [
        {
          kind: 'direct',
          key: 'antidote',
          name: COPY.useAntidote,
          target: (context) => context.facts.wolfKillTarget,
          phrase: (seat) => renderCopy(COPY.useAntidoteOn, { seat: formatSeat(seat) }),
          availability: (context) =>
            context.facts.wolfKillTarget === null
              ? { kind: 'hidden' }
              : context.facts.wolfKillTarget === context.seat && !context.state.rules.witchCanSelfHeal
                ? { kind: 'unavailable', reason: COPY.selfSaveDisallowed }
                : { kind: 'available' },
          resolve: (context) => ({ facts: { savedSeat: context.facts.wolfKillTarget } }),
        },
        {
          kind: 'pickSeats',
          key: 'poison',
          name: COPY.poison,
          count: { min: 1, max: 1 },
          seats: (context) => allSeatsSelectable(context),
          resolve: (_context, [seat]) => ({ facts: { poisonedSeat: seat } }),
        },
      ],
    },
  ],
});
```

这里可以看到三件事：自救规则只写了一次，同时决定手牌灰不灰和服务端接不接受；“同一晚不能同时用两瓶药”不需要写，因为第一条 final 提交就让这一步完成；复盘句子“对3号用解药”“毒杀3号”“未用解药”“未毒杀”由 `name` 和 `phrase` 推出。

## 8. 客户端渲染接口

```ts
// packages/web/src/features/room/steps/useStepInteraction.ts
export interface UseStepInteractionInput {
  readonly presentation: StepPresentation | null;
  /** 调用引擎的 describeStepConfirmation。 */
  readonly describeConfirmation: (selection: StepSelection) => StepConfirmation;
  readonly submit: (submission: StepSubmission) => Promise<boolean>;
  /** 播报中、正在看房间信息等不该弹窗的时候为 true。 */
  readonly isSuspended: boolean;
  readonly hasPendingCommand: boolean;
}

export interface StepInteraction {
  /** 交给现有手牌模型：引导句、进度、手牌。 */
  readonly message: string | null;
  readonly progress: NightStepProgress | null;
  readonly actions: readonly RoomPlayerAction[];
  /** 选座位进行中时交给座位盘。 */
  readonly seatSelection: {
    readonly eligible: readonly number[];
    readonly selected: readonly number[];
    readonly unavailableReasons: Readonly<Record<number, string>>;
  } | null;
  readonly onSeatTap: (seat: number) => boolean;
  readonly cardPicker: StepCardPickerModel | null;
}
```

每种动作在客户端只有一种流程：

| 动作     | 流程                                                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 选座位   | 点手牌进入选座；`max` 为 1 时点选即替换，否则逐个勾选。**选满 `max` 的那一下自动弹确认**；已达到 `min` 但没满时，手牌上出现确认按钮。确认弹窗点“取消”：单目标留在选座、可重选；多目标清空后留在选座（沿用既有规则）。 |
| 直接动作 | 点手牌 → 确认弹窗（取消／确定；`tone` 为 danger 时按钮用动作名）→ 提交。                                                                                                                                              |
| 查看信息 | 点手牌 → 先问弹窗，标题是手牌文字加问号（取消／查看）→ 内容 →“知道了”提交。已确认过的再点只是回看，不再提交。                                                                                                         |
| 选牌     | 点手牌 → 选牌面板 → 点牌 → 确认弹窗 → 提交。面板由现有 `ChooseBottomCardModal` 提升为公共组件。                                                                                                                       |

其余行为：

- 灰掉的手牌可以点，点了显示原因（沿用现有 `aria-disabled` 做法）；不可选的座位点了显示座位原因。
- `pendingResult` 非空时自动弹出结果，按钮“知道了”，点了提交确认。刷新后仍会出现，直到确认。
- 选座草稿跨刷新保留，键为步骤、serial 和动作 key。
- 确认弹窗打开期间如果 `presentation` 的 `stepId` 或 `serial` 变了，关闭弹窗并提示 A17 那一句，不提交。
- 用现有的 `useSeatPicking`、`resolveSeatPickTap`、`showConfirmAlert`、`showDismissAlert`，不新造一套。

检查：客户端步骤渲染目录和狼人杀房间夜间代码里不许出现角色 id 字面量（AST 检查，名单取自引擎的角色 id 列表）。

出处：D12–D18、D20、D21（新检查之二），「五条统一规则」第 1、4 条。

## 9. 其他游戏的写法统一（D25）

其他 8 个游戏不用步骤机制，文案仍在客户端。统一写法靠共享入口强制：

```ts
// packages/web/src/features/room/confirm.ts
/** 标题固定为“{手牌文字}？”，调用方不能自己传标题。 */
export function confirmAction(input: {
  readonly label: string;
  readonly body?: string;
  readonly tone?: 'default' | 'danger';
  readonly onConfirm: () => void | Promise<void>;
}): void;

/** 先问再看：标题固定为“{手牌文字}？”，按钮“取消／查看”。 */
export function confirmView(input: { readonly label: string; readonly onView: () => void }): void;
```

游戏代码里直接调用 `showConfirmAlert`、`showDestructiveAlert` 的地方改为调用这两个入口；再加一条检查，禁止 `packages/web/src/games/` 下直接调用底层弹窗函数。带对象的标题（“处决3号？”）由调用方把对象拼进 `label`。步骤渲染内部也走同一入口。

## 10. 新旧引擎对照

一个 PR 内部的顺序（D10、D21）：

1. 新增平台步骤机制、角色文件和新的夜间状态，旧的 `domain/` 原样保留。
2. 对照测试：把现有按板子的首夜集成场景改写成与引擎无关的“剧本”（谁在哪一步做什么），同一份剧本分别驱动新旧引擎，比较三样：死亡结果、每个行动者拿到的私密结果、每一步每个座位的可选目标。
3. 可选目标的比较有一处预期差异：狼美人、恶灵骑士对狼人不可选（A19）。旧客户端允许选而旧引擎拒绝，对照时以旧引擎的拒绝为准。
4. 对照全部一致后，客户端和 Worker 切到新引擎，再删除旧引擎、旧测试和矩阵文档。

## 11. 本文没有覆盖的部分

以下需要另行设计，开工前不应假定已经定了：

- **死亡结算的通用效果词汇**（D24、§6.2 第 9 点）。目标是角色声明“攻击、保护、连带、免疫、反伤”一类效果，计算器不认识具体角色。现有计算器里写死具体角色 26 处，哪些能归进通用词汇、哪些需要保留为角色自带的函数，需要对着现有 28 个板子场景逐个核对后才能定接口。这一块风险最高。
- **复盘文档的映射**。`buildStepReviewLines` 只产出行动句子；狼人投票的结算说明、死亡汇总、死因标签仍是狼人杀自己的内容，怎样与通用行合并成现有的复盘文档没有展开。
- **魔术师交换对其他角色目标的影响**、**底牌角色的有效身份**这类跨步骤的规则放在哪里（事实层还是上下文层）。
- **开局前流程和房主管理**里与角色相关的结构调整（D24），例如底牌分配。
- **语音素材的注册表**在客户端如何从角色文件的播报声明生成。

## 12. 开工前提

- 设计文档 D5：实现等 PR #494 合并后开始。截至 2026-11-23 本文写成时，#494 的修复提交 `ae7833bcd` 只在它自己的分支上，尚未进入 main（main 为 `a031dc10b`）。
- 本设计分支 `agents/werewolf-spec-driven-night` 从 `d020d01ac` 分出，落后于 main，开工前需要同步。

# 步骤机制接口设计

状态：**已与用户逐条确认 I1–I20（见“确认记录”）；新引擎实现正在进行。** 助手最初未经询问就写出并推送了本文，用户指出应先逐条询问，之后补问。正文中凡是落实“确认记录”的部分以确认记录为准；“助手自定”一节是用户同意由助手决定的内部结构；类型草图只表达形状，是助手的草稿。本文是 [step-action-redesign.md](step-action-redesign.md) §7“平台层步骤机制的具体接口”的展开。

类型草图只表达形状，名字和字段可以在实现时调整；调整了决定所约束的行为则需要先回到设计文档。

## 2026-11-24 更正：自刀与免疫

- **已确认：**狼美人只是不能自刀，并不免疫狼刀；魔术师交换使狼刀落到她身上时，她仍会受到攻击。
- **已确认：**恶灵骑士既不能自刀，也有免疫。这两个角色的投票限制不能再等同于同一种死亡免疫。
- **已确认：**所有狼人都不能直接选择这两个角色的座位，保持旧引擎和 A19 的投票限制。
- **已确认：**交换后狼刀落到恶灵骑士身上，新引擎按免疫让他存活；旧引擎会让他出局，这处死亡名单差异作为预期差异记录。
- **实施状态：**新角色声明及阶段 7 的新旧引擎对照已完成，结果见 §10；客户端和线上流程尚未切换。

## 2026-11-24 补充：交换与恐惧提示

- **已确认：**其他角色不知道魔术师交换；他们照常选目标，技能实际作用在交换后的另一人身上。
- **已确认：**噩梦之影封锁的实际落点会知道自己被封锁。例如交换 1 号和 2 号后，噩梦选择 1 号，2 号被封锁并知道；这是对前述“不知道被封锁”的更正。提示、灰掉技能和“不用技能”沿用停点 1 的 A1、A15、A16。
- **已确认：**交换 1 号狼人和 2 号守卫后，噩梦选择 2 号时，实际恐惧 1 号；守卫不受恐惧，所有狼人当夜不能袭击，并按 A15 看见原因。
- **已确认：**实际被恐惧的狼美人不能魅惑，全体狼人的袭击不可用并显示被恐惧的原因；未被恐惧的狼巫仍能查验。狼队集体袭击失效不等于其他狼人的个人技能失效。
- **已确认：**魔术师交换 4 号村民和 5 号狼人，觉醒石像鬼按已知座位选择与狼人相邻的 4 号时，选择有效；转化实际落到 5 号狼人，但狼人已是狼人，转化静默无效。
- **已确认：**上述无效转化仍消耗觉醒石像鬼当晚的行动，不重选；全员转化信息均显示“未被转化”。
- **已确认：**同一交换下，狼女孩选择 4 号，实际表白落到 5 号狼队友时，表白静默无效且不重选；所有人显示“未被表白”。
- **已确认：**同一交换下，狼巫选择 4 号，实际查验落到 5 号狼队友时，仍显示 5 号的真实身份，但结果中的座位写所选的 4 号，不明示交换。玩家可能从结果推测异常。
- **已确认：**预言家 3 号与村民 4 号被交换后，预言家选择 4 号，实际查验自己；查验照常生效，结果显示“4 号是好人”。
- **已验证：**交换改变恐惧的落点时，可以连带改变守卫是否生效和死亡名单；不能在 I5 已生效的同时一律要求新旧死亡名单相同。
- **待验证：**按上述已确认规则检查其他目标资格与交换后的落点组合；发现无法从已有决定推断的具体冲突时再询问。
- **实施状态：**交换落点对照、落到狼人的无效转化和无效表白已实现并验证。用户表示可按已确认规律继续。

## 确认记录

| 编号 | 决定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 日期       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| I1   | 步骤规则的形状：步骤是一份声明，列出若干动作，每个动作各带小函数（哪些座位可选、是否可用、提交后写入什么）；引导句、弹窗标题、复盘句子、提交校验、“不用技能”由平台从声明推出。声明装不下的角色开覆盖口子。这偏离了设计文档 §6.2 第 3 点原先写的“每个步骤三个函数（显示、结算、复盘）”，助手写接口时未告知就改了，事后询问，用户选了本项。未选“三个大函数，每个角色自己写全部”。                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-11-23 |
| I2   | 例外的管法：只允许覆盖平台列出的几个点（如“该座位是否完成”“步骤是否完成”），不能整个绕开；并加一条检查，哪个步骤用了哪个覆盖点必须登记在白名单里（起始 2 条：狼人投票、机械狼学到猎人）。未选“不设白名单”和“不留口子、装不下就扩充声明词汇”。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-23 |
| I3   | 死亡结算仍然重新设计一套效果词汇并重写计算器。用户是在得知更正之后做的选择：现有计算器和它的入口里具体角色名出现 0 次，已经是“角色声明标签、计算器不认识角色”；助手此前说的“写死具体角色 26 处”是把标签名（`wolfQueenLink`、`poisonSource` 等）误当成了角色。助手建议“计算器原样保留，只把标签搬进角色文件”，用户未采纳。                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 2026-11-23 |
| I4   | 死亡结算的效果词汇按下面的分法，并用新旧计算器对大量随机输入做对照来验证：**攻击**（对某座位造成一种死因：狼刀、毒、咒狐被查验致死）、**保护**（免于某种攻击：守护、解药）、**庇护**（今晚任何死亡作废：摄梦人的梦）、**连带**（A 死则 B 死，单向或双向：狼美人魅惑、摄梦人、情侣、影子与复仇者绑定）、**免疫**（对某种攻击无效：免疫毒、咒狐静默免疫狼刀）、**反伤**（对该座位用技能的人自己死：恶灵骑士）、**失效**（某来源今晚的效果全部作废：被恐惧的角色；种狼感染使那一刀作废）。结算顺序固定在计算器里，与现在相同。用户确认时补充两点：（1）摄梦人自己死了，被摄梦的人也死——即摄梦人同时有“庇护”和“连带”两种效果，已包含；（2）魔术师的交换不是“两个座位的死亡互换”，而是“对这两个人的所有技能目标都互换”——所以“交换”不属于死亡效果词汇，而是作用在选目标这一层，范围见 I5。 | 2026-11-23 |
| I5   | 魔术师交换的范围：对这两个人的**所有**技能目标都互换，没有例外，不逐条询问。交换只在“选目标”这一层做一次，之后每个技能拿到的都是换过的座位。**这是规则变更**，不属于 D24 的“行为不变”。引擎现状只在三处应用交换：查验类看到的身份（含机械狼学习）、最终死亡的转移、猎人能否开枪的状态；恐惧已读代码确认不跟随交换，禁言、禁票、诅咒、催眠、表白、转化、选榜样、模仿根据其代码路径没有交换处理推断不跟随（未逐个跑测试验证）。按本决定这些都改为跟随交换，包括跨夜的永久关系（榜样、模仿、催眠、表白）。未选“逐条定”和“保持引擎现在的行为”。                                                                                                                                                                                                                                          | 2026-11-23 |
| I6   | 角色文件的组织：一个角色一个文件，里面是这个角色的全部（卡面文字、特性、夜间步骤、死亡效果、播报、文案表）；不属于任何单个角色的共用步骤（狼人袭击）单独放在步骤文件里，由参与的狼角色各自声明参加。未选“一个角色一个目录、按内容分文件”和“按内容分、不按角色分”。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-11-23 |
| I7   | 其他游戏写法的保证方式：新增两个共享入口（确认动作、先问再看），调用方只传手牌文字，标题由入口自动加问号生成；加一条检查，游戏目录里不允许直接调用底层弹窗函数（现有约 70 处改为走共享入口）。用户知悉这保证不了正文是否多余、手牌文字起得对不对，这两样仍靠人。未选“只改文案、不加强制”和“手牌和弹窗用同一份声明生成”。                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 2026-11-23 |
| I8   | 魔术师交换后的座位号显示：玩家自己的界面只写他选的号码（“守护3号？”“查验结果：3号是狼人”），不透露被交换；夜报里被交换影响的行写“选的号码 + 实际落点”，如“守卫守护3号（实际为7号）”，未受影响的行不加括号。未选“夜报只写选的号码（现状）”和“夜报只写实际落点”。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-11-23 |
| I9   | 多个保护同时落在一个人身上：只有声明了相互冲突的保护之间才抵消，守护和解药是一对（两者同时生效则目标死亡，即“同守同救”）；每个保护声明自己和谁冲突，词汇里因此有“冲突组”的概念。未选“恰好一个保护才活、两个或更多算死”（助手的建议）和“按奇偶”。**2026-11-23 确认：**没有声明冲突的保护叠加时，只要有一个适用且生效的保护，目标就免于相应攻击。                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| I10  | 剩余取舍的处理方式：纯内部结构、不改规则、玩家看不到的部分由助手定，在文档里标明“助手自定”；§11 列出的未设计项现在就设计并逐项询问用户。未选“做到时再设计”“两类都现在逐条问”“两类都由助手定”。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-11-23 |
| I11  | 夜报里的结果说明句由新死亡计算器输出的结算记录生成，每种效果一句通用句式（保护冲突、免疫、反伤、连带等），新增角色不用为夜报写代码；只覆盖现在有说明的那几种情况（同守同救、免疫毒、反伤、感染成功或失败、死亡名单里的“狼队 N 票锁定”“××下毒”），夜报长度不变。狼人投票说明仍由狼人袭击那一步自己写。未选“每个生效的效果都写”和“保持每种情况单独写代码”。                                                                                                                                                                                                                                                                                                                                                                                                                            | 2026-11-23 |
| I12  | “某个座位今晚算什么”分三层，每层只定义一次：**身份**（这个人今晚实际是什么角色：发到的牌；盗贼选牌后永久变成那张；盗宝大师当晚获得所选牌的技能；种狼感染后变成普通狼人）、**落点**（技能点的号码实际落在谁身上：魔术师交换，I5）、**所见**（查验类技能看到什么：身份加机械狼的伪装）。谁在哪一步行动、有什么被动效果看身份；技能选座位后先过落点再生效；查验结果看落点上那个人的所见。“预言家查到交换后的身份”不再是单独的规则，由落点层自然得出。未选“不分层、每个角色自己处理”。                                                                                                                                                                                                                                                                                                   | 2026-11-23 |
| I13  | “角色在场就改变整局规则”的规则搬进各自的角色文件，只能从固定的几个点里声明，行为不变。现有四条：毒师在场首夜狼人不能袭击（开夜时写入一条事实）、丘比特在场狼人投票须全票一致（狼人投票规则）、盗贼和盗宝大师的底牌发牌规则、多个预言家系角色的播报编号。流程代码不再点名角色；新增声明点要改平台并登记白名单（同 I2）。未选“留在流程代码里”。                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-23 |
| I14  | 语音素材按文件名约定自动收集（与仓库里头像、徽章的现有做法一致），去掉客户端手写的登记表；加一条检查，角色文件声明的每个播报都必须能找到文件。播出的声音不变。未选“保留手写登记表”。**2026-11-23 确认：**灯影预言家、酒鬼预言家在各自角色文件中显式声明复用预言家的播报。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| I15  | 合并 main 后确认：状态栏只有一行状态文字，引导句各部分合成一段显示（情况在前、操作说明在中、规则提示在后）；狼人投票状态句与共享句式对齐。详见设计文档 D38、停点 1 的 A21。因此步骤声明里把提示分成“情况提示”和“规则提示”两种，界面数据里的引导句是一段文字而不是多行。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-11-23 |
| I16  | **2026-11-23 确认：**狼人选择的座位经魔术师交换后，若实际落点对狼刀免疫，则狼刀静默无效，目标不死且不给狼人提示；目标是否可选仍只按狼人本来有权知道的信息判定。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| I17  | **2026-11-23 确认：**对某攻击适用、且未与其他保护声明冲突的保护，只要有一个有效，就足以阻止该攻击；明确声明的冲突保护仍按冲突规则结算。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| I18  | **2026-11-23 确认：**目前没有角色需要破保护攻击，因此不在本次重写中增加通用穿透字段或规则；等出现实际角色需求时，再明确它能穿透哪些保护以及与庇护、免疫的关系。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| I19  | **2026-11-23 确认：**受魔术师交换影响的夜报行动句显示所选号码和实际落点（“所选动作 + 所选号码（实际为N号）”）；对应 I8。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| I20  | **2026-11-23 确认：**一个步骤有多个动作时，生成的操作说明只来自选座位动作；直接动作由手牌表达，不另生成操作说明。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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
  /** 引导句里的操作说明。省略时按人数从 name 生成。 */
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
  /** 生成手牌文字的标题；手牌文字 = “查看” + title。 */
  readonly title: string;
  /** 内容弹窗标题；省略时沿用 title。 */
  readonly contentTitle?: string;
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
- “不用技能”不由角色声明。步骤声明 `skippable`，平台自动加这张手牌，并在操作说明后接上“如不使用请点击「不用技能」”。
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
  /** 全员查看步骤显式声明范围，不能根据行动者数量推断。 */
  readonly audience?: 'allSeats';
  readonly actions: readonly StepAction<TContext, TFacts, TResult>[];
  /** 是否可以不用技能。必须行动的步骤返回 false。 */
  readonly skippable: (context: TContext) => boolean;
  /** 步骤被锁住的原因（被恐惧、当夜无法袭击）。非 null 时除 staysWhenLocked 的动作外都不可用，并强制提供“不用技能”。 */
  readonly lock?: (context: TContext) => string | null;
  /** 情况提示（谁被袭击、平安夜）：排在生成的操作说明之前。 */
  readonly situationHints?: (context: TContext) => readonly string[];
  /** 规则提示（榜样的后果、可以选择自己）：排在操作说明之后。 */
  readonly ruleHints?: (context: TContext) => readonly string[];
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

两个已知的非默认情况（I2 的白名单起始条目），接口都能容纳：

- **狼人投票**：袭击和“放弃袭击”分别为可改票的 `pickSeats` 和 `direct` 动作，通过同一个 `revisionGroup` 互相替换；“撤回袭击投票”是一个 `direct` 动作，`availability` 读记录判断是否已投，并撤回当前票。不能袭击时按 A15 禁用袭击，但保留“放弃袭击”。`completion` 在全员投完时返回 `armCountdown`，沿用平台已有的 `decideSettleCountdownArm`；全体无法袭击时先让每个狼人看到原因并放弃袭击，再推进。
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
  /** 引导句，一段文字：情况提示、生成的操作说明（可跳过时接上“如不使用…”）、规则提示。非行动者为 null。 */
  readonly message: string | null;
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

- 命令：每个游戏一条 `<game>.step.submit`，载荷是 `StepSubmission`。狼人杀现有的 `werewolf.action.submit`、`werewolf.reveal.ack`、`werewolf.groupConfirm.ack`、`werewolf.wolfRobot.ackHunterStatus` 合并为它；阿瓦隆和秘密希特勒的夜间确认命令已迁移为它。房主的“标记机器人已确认”命令（`werewolf.groupConfirm.ackBots`、`avalon.bots.markAllBotsGroupConfirmed`、`secrethitler.bots.markAllBotsGroupConfirmed`）保留，内部调用 `planBotAcknowledgements`。
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
      situationHints: (context) =>
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
  /** 交给现有手牌模型：引导句、进度、手牌。引导句显示在合并后的 `RoomCompactStatus` 那一行状态文字里；步骤标题进现有的夜间进度标签。 */
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
- 用现有的 `useSeatPicking`、`resolveSeatPickTap`、共享入口 `confirmAction` / `confirmView`（§9）和 `showDismissAlert`，不新造一套。

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
  readonly confirmText?: string;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly onShown?: (generation: number | null) => void;
}): void;

/** 先问再看：标题固定为“{手牌文字}？”，按钮“取消／查看”。正文只写额外后果（如 B8“昨夜信息可能影响警长竞选。”）。 */
export function confirmView(input: {
  readonly label: string;
  readonly body?: string;
  readonly onView: () => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly onShown?: (generation: number | null) => void;
}): void;
```

游戏代码里直接调用 `showConfirmAlert`、`showDestructiveAlert` 的地方改为调用这两个入口；再加一条检查，禁止 `packages/web/src/games/` 下直接调用底层弹窗函数。检查是 `packages/web/src/__tests__/roomDialogEntry.contract.test.ts`：禁止 `showAlert`、`showAlertWithGeneration`、`showConfirmAlert`、`showDestructiveAlert`；单按钮的报错和通知（`showErrorAlert`、`showDismissAlert`、`showPrompt`）照常允许（BQ8）。狼人杀“昨夜信息”原来的 BQ5 例外已由 B.10 子手牌取代，无需白名单。带对象的标题（“处决3号？”）由调用方把对象拼进 `label`。步骤渲染内部也走同一入口。

## 9a. 身份、落点、所见（I5、I8、I12）

“某个座位今晚算什么”分三层，每层在狼人杀的上下文里只定义一次，角色文件只调用、不自己实现：

```ts
interface WerewolfStepContext extends StepContextBase<GameState, NightFacts, NightResult> {
  /** 身份：这个人今晚实际是什么角色。发牌 + 盗贼／盗宝大师选牌 + 种狼感染。 */
  readonly roleOf: (seat: number) => RoleId;
  /** 落点：技能点的这个号码实际落在谁身上。魔术师交换。 */
  readonly landing: (chosenSeat: number) => number;
  /** 所见：查验类技能看到的角色。身份 + 机械狼的伪装。 */
  readonly seenRole: (seat: number) => RoleId;
}
```

- 谁在哪一步行动、有什么被动效果，用 `roleOf`。
- 任何技能选了座位之后，写入事实和产生效果之前先过 `landing`。平台在调用 `resolve` 前统一做这一步，角色文件拿到的已经是落点，同时保留玩家选的号码。
- 查验结果用 `seenRole(landing(chosen))`。
- 魔术师之前行动的步骤（盗贼、盗宝大师、丘比特）不受影响，因为那时交换还没发生。
- 提交记录里存玩家选的号码；落点由交换这条事实推出，不另存。
- 显示：玩家自己的界面只出现他选的号码；夜报里被交换影响的行写“守护3号（实际为7号）”（I8）。

狼人点的号码落在免疫狼刀的角色身上时（例如恶灵骑士或咒狐的号码被换走），这一刀无效、没有提示（I16）。落在狼美人身上时正常结算；狼美人和恶灵骑士不可直接作为投票目标是独立的投票限制，座位是否可选按狼人知道的信息判断（D32），不因交换而改变。

## 9b. 死亡结算的效果词汇（I3、I4、I9、I11）

计算器只认下面这些效果，不认识角色。以下类型是助手的草稿，要用新旧计算器的对照测试来校正：

```ts
type DeathEffect =
  | { kind: 'attack'; cause: DeathCause; source: number | null; target: number }
  | {
      kind: 'protect';
      source: number;
      target: number;
      against: readonly DeathCause[];
      /** 同一冲突组里的两个保护同时生效，则目标死亡（守护和解药是一组）。null 表示不与任何保护冲突。 */
      conflictGroup: string | null;
    }
  | { kind: 'shelter'; source: number; target: number }
  | { kind: 'link'; from: number; to: number; cause: DeathCause; isMutual: boolean }
  | { kind: 'immune'; seat: number; against: readonly DeathCause[] }
  | { kind: 'reflect'; seat: number }
  | { kind: 'void'; scope: { source: number } | { cause: DeathCause; target: number } };

interface DeathResolution {
  readonly deaths: readonly number[];
  readonly causes: Readonly<Record<number, readonly DeathCause[]>>;
  /** 结算记录：哪个攻击被挡、哪两个保护冲突、哪个免疫生效、哪个反伤和连带触发。夜报的说明句由它生成（I11）。 */
  readonly trace: readonly DeathTraceEntry[];
}

function resolveDeaths(effects: readonly DeathEffect[]): DeathResolution;
```

- 来源：动作的 `resolve` 除了写事实，还可以返回效果（守护、毒杀、魅惑）；角色文件另有一处声明被动效果（免疫、反伤）和关系带来的连带（情侣、绑定）。
- 结算顺序固定在计算器里，与现在相同：攻击与保护 → 庇护 → 连带直到稳定 → 反伤 → 再一轮连带。
- 魔术师交换不在这里：效果里的座位已经是落点（§9a）。现有计算器最后那步“死亡转移”随之取消，现有死因标签“魔术师交换”改由“落点与所选不同”推出。
- 是否能投票选择与伤害免疫分开声明：狼美人只有投票限制，恶灵骑士两者都有，咒狐只有狼刀免疫；真正的免疫在结算中使用 `immune`（D32、A19、I16）。
- “失效”有两种范围：某个来源今晚发出的效果全部作废（被恐惧）；某一次攻击作废（种狼感染使那一刀作废）。
- 反伤现在只对两类指向触发：预言家系的查验、毒药。草稿里这两类动作要显式标记“可被反伤”，其他技能不触发，以保持现有结果。
- 多个没有声明冲突的保护叠加时，有一个适用且生效的保护就足以免死（I17）。
- 本次不加入通用破保护攻击机制；等有实际角色需求时再定义具体可穿透的保护种类及其与庇护、免疫的关系（I18）。
- 夜报的说明句只覆盖现在已有的几种情况（I11）：保护冲突、免疫毒、反伤、感染成功或失败、死亡名单里的“狼队 N 票锁定”“××下毒”。

验证：计算器是纯函数。保留旧计算器，对同一批输入各算一遍比较死亡名单和死因；输入除现有板子场景外，用随机生成的大量组合。不含魔术师交换的输入要求完全一致；含交换的输入，逐项核对恶灵骑士免疫和 I5 落点变化及其连锁效果造成的差异，不能把未解释的差异当作通过。

## 9c. 角色在场对整局的影响（I13）

角色文件里声明，只能用平台列出的声明点，流程代码按声明点查询、不点名角色：

| 声明点         | 现在的使用者   | 行为（不变）                     |
| -------------- | -------------- | -------------------------------- |
| 开夜时写入事实 | 毒师           | 首夜狼人不能袭击                 |
| 狼人投票规则   | 丘比特         | 投票须全票一致，否则视为放弃袭击 |
| 发牌规则       | 盗贼、盗宝大师 | 底牌的合法组合                   |
| 播报编号       | 预言家系       | 多个预言家系角色按“1号、2号”编号 |

新增声明点要改平台并登记白名单，与 I2 同一张表。

## 9d. 语音素材（I14）

角色文件在步骤里声明播报名字；客户端按文件名约定从 `assets/audio/` 和 `assets/audio_end/` 自动收集，做法与现有的头像、徽章相同；一条检查保证每个声明的播报都有文件。共用播报（灯影预言家、酒鬼预言家用预言家的）在角色文件里写明使用哪个名字。

## 9e. 助手自定（I10）

以下只涉及内部结构，不改规则，玩家看不到。用户同意由助手决定：

1. 每个游戏的夜间提交合并成一条命令（§6）。
2. 对局状态用一份按“步骤 × 座位”的记录，取代专属字段；进行中的旧房间失效（§5）。
3. 界面数据里用一个 `step` 字段取代狼人杀夜间的十几个字段（§6）。
4. 机械狼学到猎人后的“查看技能状态”仍在同一步里，不拆成新步骤（§4）。
5. 确认弹窗开着时步骤变了，关掉弹窗并提示，不提交（§8）。
6. “中文只能写在文案表里”的检查用语法树实现，文案表与角色同文件（§2）。
7. 选底牌的面板提升为公共组件（§8）。
8. 步骤机制在引擎平台层的目录位置（§1）。
9. 新旧引擎对照的做法（§10）。

沿用现有行为、没有改动的三条：角色在底牌里的空步骤照常播报并随机等待；“取消／查看”先问弹窗只在客户端、不登记；选座草稿刷新后保留。

## 10. 新旧引擎对照

一个 PR 内部的顺序（D10、D21）：

1. 新增平台步骤机制、角色文件和新的夜间状态，旧的 `domain/` 原样保留。
2. 对照测试：把现有按板子的首夜集成场景改写成与引擎无关的“剧本”（谁在哪一步做什么），同一份剧本分别驱动新旧引擎，比较三样：死亡结果、每个行动者拿到的私密结果、每一步每个座位的可选目标。
3. 对照可选目标时，狼美人、恶灵骑士对狼人不可选（A19）；旧客户端允许选而旧引擎拒绝，以旧引擎的拒绝为准。目标资格不能暴露魔术师交换；旧引擎在交换狼人后可能按交换后的狼人位置判断觉醒石像鬼的相邻资格，需要单独报告。
4. I5 是规则变更：含魔术师交换的剧本里，技能落点和它引发的后续结果可与旧引擎不同，包括死亡名单。每处差异按实际剧本和已确认规则核对；交换后狼刀落到恶灵骑士的免疫差异也单独报告。实施及完整对照完成前不能声称通过。
5. 对照通过后，客户端和 Worker 切到新引擎，再删除旧引擎、旧测试和矩阵文档。

对照驱动实际提交校验和非空步骤推进（包括狼人倒计时）；底牌空步骤的随机等待尚未接入，此项须在第 9 个 commit 的游戏接入中实现并验证，不属于本次三项结果对照。接入时狼人投票事实也必须按当前记录处理：改票替换原票、撤回移除票并取消未完成的倒计时。

### 阶段 7 对照结果（2026-11-24）

- 完整夜晚对照 159 项通过：27 个预设、122 个整理后的既有场景、6 个盗贼／盗宝大师底牌场景、3 个恶灵骑士／咒狐定向场景，以及 1 项含 128 组固定种子动作序列的随机对照。
- 交换落点对照 22 项通过，其中一项包含 320 组固定种子样本；另有定向检查覆盖 A19、恐惧提示和推进、无效转化／表白、查验座位显示、恶灵骑士免疫及狼美人受伤。
- 预期差异：A19 在客户端禁选狼美人和恶灵骑士，但旧引擎本已拒绝；I5 让恐惧、禁言、禁票、诅咒、催眠、表白、转化、榜样及模仿作用于交换后的落点，并可能连带改变死亡；觉醒石像鬼资格按所选座位判断，落到狼人时转化无效；狼女孩表白落到狼队友时无效；交换后狼刀落到恶灵骑士时新引擎免疫、旧引擎出局。狼人因恐惧或毒师无法袭击时，新步骤保留灰掉的袭击和“放弃袭击”，待狼人看到原因后推进。
- 定向引擎测试共 878 项、根架构契约 3276 项通过；引擎构建和类型检查、根类型检查、改动文件 lint／格式检查及 `knip` 通过。

## 11. 尚待实现验证的细节

原先列在这里的五项（死亡结算的词汇、夜报的说明句、身份分层、在场影响、语音）已经由 I3–I5、I9、I11–I14 确定。剩下的是实现时才能定的细节：

- §9b 的类型草稿是否足以表达现有全部结果，要靠新旧计算器的对照测试校正；反伤的触发范围要对照现有实现核实。
- I5 是规则变更，需要新增场景测试覆盖：恐惧、禁言、禁票、诅咒、催眠、表白、转化、选榜样、模仿在有交换时的落点。这些场景现在没有测试。
- 通用行动句、狼人投票说明、结果说明、死亡汇总合并成现有夜报结构的代码组织。
- 通用破保护攻击机制不在本次范围；若将来有角色需要，届时再确定它能穿透哪些保护以及与庇护、免疫的关系（I18）。

## 12. 开工前提

见 [step-action-implementation-plan.md](step-action-implementation-plan.md)：读什么、哪些是硬性决定、commit 计划和停点。

更正：本节原先写“PR #494 的修复提交只在它自己的分支上，尚未进入 main（main 为 `a031dc10b`）”，是错的。#494 是 squash 合并，`a031dc10b` 正是它的合并提交；助手当时用“原提交是否在 main 的历史里”来判断，squash 合并下这个判断不成立。设计文档 D5 的前置条件已经满足。

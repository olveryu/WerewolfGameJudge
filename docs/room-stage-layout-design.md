# 进行中舞台布局（你画我猜 / 你画我猜接龙 / 轮流讲故事 / 一眼成对）

> 状态：设计已确认（2026-11-10），并按本文落实到正式页面。
> 视觉基准：评审通过的静态 mock（375×667 / 390×844 / 320×568 / 768×1024 四档）。
> 归属：共享部分改 `RoomShell`，规则写回 [room-shell-contract.md](room-shell-contract.md)。

## 1. 问题

这三款游戏进行中时，一屏同时堆了：标题栏、对局工作区自带的标题与倒计时、`AnsweringTopBar`（倒计时环 + 头像串）、
接管横幅、底部面板（「第 n 步 / 共 m 步」进度行 + 房主任务卡里的「主持管理 · 全部操作」入口）、右下角接管浮钮。
进行中三款游戏的房主任务都是 `null`，底部面板只剩一行进度和一个入口，却稳定吃掉一整块高度；画布和编辑框被压到最小。

## 2. 目标布局

自上而下四段，画布 / 编辑框拿走全部剩余高度：

| 段            | 内容                                                                                                                                                                                              | 归属                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 标题栏        | 返回、房间号、分享；「菜单」入口；头像                                                                                                                                                            | `RoomShell`                            |
| 信息条（HUD） | 一行 chip：游戏信息（第几棒 / 第几轮 / 题目提示 / 活动阶段）、名单 chip、倒计时 chip；第二行可显示接管 chip、次要信息（我的分数）和游戏提供的轻量操作；下方一条倒计时细条；窄屏优先保留首行倒计时 | `RoomShell` 渲染，游戏给模型与可选操作 |
| 主区          | 题目卡、画布 / 上一棒内容 / 编辑框；你画我猜的猜词摘要条（宽屏为侧栏）                                                                                                                            | 游戏                                   |
| 底部操作区    | 画图工具栏 + 整宽主按钮，或输入框 + 发送                                                                                                                                                          | 游戏                                   |

## 3. 决策

1. **适用范围**：只在三款游戏的「进行中」阶段——你画我猜 `wordSelect` / `drawing` / `roundEnd`，
   接龙两款 `answering` / `transition` / `settling`。大厅、画廊、终局（有复盘、再来一局）与其他游戏不变。
2. **舞台菜单**：舞台阶段由标题栏的「菜单」按钮打开；手册、配置和可用的阶段操作都从菜单进入，
   不渲染底部面板。舞台阶段房主任务必须为 `null`、底部动作必须为空，违反即抛错（fail fast）。
3. **机器人接管**：并入名单。名单 chip 点开底部抽屉，按「正在行动 / 未完成 / 已完成」分组列出所有在座玩家；
   房主未接管时，未完成的机器人行带「接管」按钮。删除 `BotTakeover` 浮钮与 `TakeoverSheet`。
   你画我猜也有名单 chip；机器人画手剩余不到 30 秒且无人接管时 chip 带「!」。
4. **接管状态**：舞台阶段不渲染 `ControlledSeatBanner`，改为信息条里的「代 N 号 · 退出」chip
   （沿用 `controlledSeatBanner` / `controlledSeatReleaseButton` 测试 id）。
5. **步进进度**：舞台阶段的「第 n 步」进度不再进底部面板，改为游戏信息 chip（「第 3/6 棒」）；
   你画我猜接龙的揭晓进度由画册和棒次展示，不另加底部进度行。
6. **画图工具栏**：保留全部功能（工具面板、颜色面板含最近使用与 HSV、粗细、撤销 / 重做、清空），
   按钮改纯图标、保留可访问名称，降低一行高度。
7. **倒计时**：统一为信息条 chip + 细条；不限时显示「不限时」且无细条；剩余 ≤ 10 秒变红。
   替换 `AnsweringTopBar` 与你画我猜自带的倒计时。
8. **你画我猜互动与排名**：累计排名从信息条的游戏操作打开，可实时查看本局积分并列名次；鲜花、鸡蛋、番茄只在服务端确认新互动后飞入画布并呈现花束、蛋液或番茄飞溅，赠送者通过画布动画播报，不在底部重复列名。初始快照不重播，多个互动依序播放并遵守减少动态效果偏好。

## 4. 共享模型

四款游戏统一复用 `RoomStageHud` 与 `RoomStagePanel` 的蓝灰描边、圆角、错位阴影和间距；游戏不复制这些视觉规则。
普通舞台由外壳放置信息条；需要嵌入的舞台可用 `element(renderHud)` 渲染同一个 HUD，并提供中间反馈和语义 tone。
嵌入只省去外边距，不移除共享边框；名单、倒计时、排名操作、机器人接管仍由共享组件保留。
终局排行榜复用 `RoomRanking`；游戏负责排序、并列名次和统计含义，组件只负责展示，不跨游戏导入实现。

`RoomShell` 的 `content` 新增第三种：

```ts
{
  kind: 'stage';
  hud: RoomStageHudModel;
  element: ReactElement;
}
```

```ts
interface RoomStageHudModel {
  chips: readonly RoomStageChip[]; // 游戏信息，按顺序渲染在名单 chip 之前
  roster: RoomStageRosterModel | null; // 名单 chip + 抽屉
  timer: RoomStageTimerModel | null; // 倒计时 chip + 细条
  secondaryChips: readonly RoomStageChip[]; // 倒计时与接管 chip 之后（你画我猜的分数），窄屏先折行
}
interface RoomStageChip {
  key: string;
  label: string;
  detail: string | null;
  tone: 'neutral' | 'accent';
}
interface RoomStageTimerModel {
  label: string;
  remainingSeconds: number | null;
  totalSeconds: number | null;
}
interface RoomStageRosterModel {
  chipLabel: string;
  title: string;
  groupTitles: { acting: string; pending: string; done: string };
  actingSeat: number | null; // 你画我猜的画手
  pendingLabel: string; // 无状态徽标的座位显示的状态
  isUrgent: boolean;
}
```

- 名单行由共享纯函数 `groupRoomStageRoster(seatSource, actingSeat)` 从 `RoomSeatDataSource` 推导：
  在座玩家逐个归组（`actingSeat` → 正在行动；状态徽标 `tone === 'success'` → 已完成；其余 → 未完成），
  状态文字取徽标文案，无徽标取 `pendingLabel`。游戏用同一函数算 chip 上的计数，名单不读游戏状态。
- 接管按钮读 `model.capabilities.canTakeOverBots`，接管中（`model.controlledSeat !== null`）不显示。
- 主区与底部操作区仍用 `RoomTaskFrame`（header = 题目卡或空，footer = 底部操作区），沿用其键盘避让。

## 5. 游戏改动

- **你画我猜**：倒计时、轮次、题目 / 提示、我的累计分进信息条；信息条内提供可打开的本局总排名；作画阶段窄屏把猜词流收成「最近两条 + N 条」摘要条，
  点开是聊天式记录抽屉，宽屏（≥ 768px）保持右侧栏；画手的工具栏进底部操作区，猜词者的输入框进底部操作区；
  每轮结算榜显示画手本轮收到的鲜花、鸡蛋、番茄数，终局排名显示各玩家本局累计收到数；
  分享复盘逐轮列出画手本轮收到数，最终排名在玩家姓名下显示本局累计；两处都按画手归属，只展示数量、不列赠送者；
  `roundEnd` 的底部等待句「等待本轮结算」删除，由信息条的「结算」倒计时承载。`wordSelect` 在服务端出题完成前没有
  截止时间（引擎 `deadlineAt: null`），这段时间信息条不显示倒计时，机器人画手也不标红。
- **你画我猜接龙**：第几棒 chip、名单 chip（`answering` 状态徽标改为按 `readySeats` 显示「已完成 / 作答中」，
  修正现在作答期间永远显示 0 人提交的问题）、倒计时；题目卡一行；底部为工具栏 + 整宽主按钮或输入框 + 主按钮。
- **故事接龙**：第几段 chip、名单 chip、倒计时；上一段默认展开、最多占主区 45%、可收起成两行；
  编辑框填满剩余高度，字数在右下角；底部整宽「准备好了」。

## 6. 契约与测试

- `room-shell-contract.md`：新增「舞台内容」一节；房主任务卡「唯一常驻房主入口」改为「非舞台内容时」；
  接管横幅、进度行在舞台内容下的替代写明。
- 三款游戏的引导矩阵：舞台阶段豁免理由由「底部进度行」改为「顶部信息条」。
- `pictionaryBottomProgress.test.ts` 改为只覆盖画廊；新增各游戏信息条模型测试、`groupRoomStageRoster` 测试、
  `RoomShell` 舞台渲染测试（标题栏主持管理、空底部断言、接管 chip、名单抽屉接管）。
- 删除 `AnsweringTopBar`、`answeringTopBarSeats`、`BotTakeover`、`TakeoverSheet` 及其测试。

## 7. 提交拆分

1. 共享：舞台内容、信息条、名单抽屉、标题栏主持管理、工具栏纯图标；契约文档。
2. 你画我猜迁移。
3. 你画我猜接龙迁移。
4. 故事接龙迁移；`BotTakeover` 浮钮与 `TakeoverSheet` 随之无人使用，同一提交删除。
5. 删除废弃代码（`AnsweringTopBar`、`answeringTopBarSeats`）。

每步跑受影响范围的单测、web typecheck、eslint / prettier（改动文件）、knip、根契约；最后在四档尺寸做一次浏览器验收。

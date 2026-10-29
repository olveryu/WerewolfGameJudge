# 跨游戏本局复盘与图片分享设计

> 状态：设计稿 v2（2026-10-29），未实施。方向：**完全重建**，不保留现有各游戏的复盘/导出组件。§1 记录现状供追溯；§3–§8 为目标实现；决策见 §10。
> 范围决定：只做「统一复盘 + 图片分享」，不做独立只读战报链接与长期存档（§2.2、§10）。
> 关联：[room-shell-contract.md](room-shell-contract.md) §Host Task / §Action Ownership、[multigame-platform-design.md](multigame-platform-design.md) §20.3 / §25、[DESIGN.md](DESIGN.md)。

## 1. 现状

### 1.1 七种终局呈现，三种导出写法

| 游戏       | 终局呈现                                                                                                    | 导出                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| werewolf   | `NightReviewModal`（`BaseCenterModal`）；正文 `NightReviewReportBody`；版式/文案单源 `nightReviewLayout.ts` | `NightReviewShareCard` 隐藏挂载 → `useNightReviewShare` → `shareNightReview.ts`；带进度、取消、缓存 |
| avalon     | `AvalonReviewOverlay`（RN `Modal` slide，自带样式表）；主持台 `onReviewPress` 打开                          | 无                                                                                                  |
| undercover | `UndercoverRoomScreen` 座位盘上方内联 `undercover-results` 段                                               | 无                                                                                                  |
| fibking    | 无独立复盘面                                                                                                | 无                                                                                                  |
| drawguess  | `DrawGuessEndedView` 在 `StageFrame` 内渲染 `最终排名` 计分板                                               | 无                                                                                                  |
| pictionary | 画廊 `PictionaryGalleryStage`                                                                               | `PictionaryAlbumExport`：`RoomDialog` + 单篇画册 + 等图片加载 + 重试                                |
| storyrelay | 画廊 `StoryRelayGallery`                                                                                    | `StoryRelayImageShare` / `useStoryRelayImageShare`：`RoomDialog` + 单篇故事                         |
| demo       | 无                                                                                                          | 无                                                                                                  |

### 1.2 已经共享、本设计直接复用的部分

- 房间壳：`RoomShell` 承载 header / 座位盘 / 底部操作栏 / 主持管理 / 邀请弹窗。
- 动作归属：`RoomBottomActions`（`audience: 'participant' | 'anyone'`）与 `RoomHostManagement`（sections + task，按 key 引用）；`createRoomShellModel` 装配期校验。狼人杀的 `night-review` 任务已走这条路径。
- 截图：`captureViewPngBase64`（Web html2canvas / native `captureRef`）与 `captureViewSegmentedPngBase64`（Web 1024px 分带拼接）。
- 分发：`shareImage.ts` 的 `shareImagesBase64` 覆盖三端——小程序 `uploadShareImage`（`POST /share/image`，R2 一天过期）+ `wxPreviewImage`；浏览器 `navigator.share({ files })` 回落下载；native `expo-sharing`。

### 1.3 漂移清单

| 维度          | werewolf                                              | pictionary / storyrelay                                        | avalon / undercover / drawguess  |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| 容器          | `BaseCenterModal` + 报告配色                          | `RoomDialog`                                                   | RN `Modal` / 内联 / `StageFrame` |
| 正文复用      | 弹窗与截图同一 `NightReviewReportBody`                | 导出正文与画廊正文是两份 JSX                                   | 无导出正文                       |
| 截图方式      | 小程序分带，其余整图                                  | 始终整图                                                       | —                                |
| 就绪条件      | 两帧 `requestAnimationFrame`                          | pictionary 等 `Image.onLoad`；storyrelay 无                    | —                                |
| 进度 / 取消   | `ShareProgressModal` + 取消 token + 作用域缓存        | 仅 `isSharing` 布尔                                            | —                                |
| 小程序路径    | 自行 `uploadShareImage` + `wxPreviewImage`            | 交给 `shareImagesBase64`                                       | —                                |
| 结果语义      | `'shared' \| 'cancelled' \| 'failed'`（字符串判取消） | 成功 = 未抛错                                                  | —                                |
| 失败反馈      | `handleError` toast / `showErrorAlert`                | `handleError` alert                                            | —                                |
| 文件名 / 标题 | `room-${roomCode}-review.png` / `狼人杀房间 X 战报`   | `pictionary-${roomCode}-${round}-${seat}.png` / `你画我猜接龙` | —                                |
| 权限          | 服务端 `shareNightReview(allowedSeats)` 逐座位授权    | 终局人人可导出                                                 | avalon 终局人人可看              |

结论：公共动作框架已经存在；复盘承载、正文、导出生命周期、结果语义、失败反馈每个游戏各写一套。狼人杀的报告版式是最完整的，但被锁在 `src/games/werewolf/room/` 里。

## 2. 目标与非目标

### 2.1 目标

1. **游戏只产数据。** 每个游戏实现一个纯函数 `state → RoomReviewDocument`，不写复盘 JSX。
2. **一个渲染器。** 平台用同一个 `ReviewDocumentView` 渲染房内视图与导出图；一致性由构造保证，不靠测试对齐。
3. **一套报告设计语言。** 狼人杀 `nightReviewLayout.ts` 的配色、座位徽章、死亡印章、阵营色轨、标签升级为共享 `reportTheme`，所有游戏的复盘长得像同一款产品。
4. **一条导出链路。** 就绪 → 截图 → 分发 → 结果只实现一次；三端行为与反馈文案统一。
5. **新游戏零样板。** 生成器模板带 `buildReview` 骨架；缺复盘的游戏在契约测试里失败。

### 2.2 非目标

- 不做独立只读战报链接、不做战报持久化。`/share/image` 仍是一天过期的临时预览图。
- 不改游戏规则、阶段机、服务端权限模型。狼人杀逐座位授权保持原样。
- 不替换 html2canvas / view-shot / expo-sharing。
- 服务端改动仅限经典画猜 `turnHistory`（§5.5、§8.5）；其余游戏终局状态已足够。

## 3. 设计原则

1. **游戏拥有事实与文案，平台拥有版式与流程。** 文档里的每个中文字符串由游戏给出；文档的每个像素由平台画出。
2. **数据，不是组件。** `RoomReviewDocument` 可 `canonicalJson` 序列化（图片块的加载函数除外）。这让缓存键、单测、快照都变成纯数据比较。
3. **块词汇有限且封闭。** 渲染器只认 §4.2 列出的块类型；游戏需要新表达时先扩词汇再用，不允许「自定义 JSX 块」逃生口。
4. **导出的是完整文档。** 分页由游戏按语义声明（一篇画册一页）；平台只校验单页高度上限，不按像素拆页。
5. **结果诚实。** 区分「交给系统分享面板」「下载」「微信预览」「取消」「失败」。
6. **Fail fast。** 终局缺少应有事实（`winner` 为空、座位无角色）是构造错误，抛错而非占位。

## 4. 契约

全部位于 `src/features/room/review/`。game-engine 不新增字段。

### 4.1 复盘贡献（游戏实现）

```ts
/** defineClientGameModule({ review }) 必填；狼人杀在自己的 module 装配点声明。 */
export interface RoomReviewContribution<TState> {
  readonly resolve: (input: {
    readonly state: TState;
    readonly viewer: RoomViewer;
    readonly roomCode: string;
  }) => RoomReviewAvailability;
}

export type RoomReviewAvailability =
  | { readonly kind: 'notEnded' } // 入口不渲染
  | { readonly kind: 'notPermitted'; readonly message: string } // 入口禁用 + 原因（狼人杀未授权座位）
  | { readonly kind: 'available'; readonly document: RoomReviewDocument };

export interface RoomReviewDocument {
  /** 本局标识（roundId / gameSequence / roleRevealRandomNonce）；平台与 roomId、userId、内容摘要合成缓存键。 */
  readonly roundKey: string;
  readonly title: string; // 房内标题：「阿瓦隆 · 本局复盘」
  readonly kicker: string; // 页眉小字：「🌙 第一夜 · 夜报」「🏰 第 3 局 · 终局」
  readonly shareTitle: string; // 图片页眉与系统分享标题：「房间 1234 战报」
  readonly fileStem: string; // `${gameType}-${roomCode}-${roundTag}`；多页追加 `-p1`
  readonly footer: string; // 「仅供裁判及观战者参考 · 本夜报由对局记录自动生成」
  /** 中止局为 true：页眉加「未完成」戳，标题不变。 */
  readonly isAborted: boolean;
  readonly pages: readonly RoomReviewPage[]; // ≥ 1
}

export interface RoomReviewPage {
  readonly key: string;
  readonly label: string | null; // 多页时的页签：「第 1 篇 · 3 号的画册」
  readonly blocks: readonly ReviewBlock[]; // ≥ 1
}
```

约束：`resolve` 为纯函数；同一 `state` 两次调用结构相等。`notPermitted.message` 为中文，直接用作入口 `disabledReason`。

### 4.2 块词汇（封闭集合）

语义色调，不出现游戏词汇；游戏自己决定「狼人 → `evil`」「白板 → `special`」：

```ts
export type ReviewTone = 'neutral' | 'good' | 'evil' | 'special' | 'out' | 'highlight' | 'muted';

/** 行内元素：文字、座位徽章、标签。座位号只出现在徽章上，文字里不再写「3号」。 */
export type ReviewInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'seat'; readonly seat: number; readonly tone: ReviewTone }
  | { readonly kind: 'tag'; readonly text: string; readonly tone: ReviewTone };

export type ReviewBlock =
  /** 结论区：大标题 + 印章（出局者）+ 副标题。狼人杀「昨夜 1 人出局」、阿瓦隆「好人阵营胜利」。 */
  | {
      readonly kind: 'hero';
      readonly headline: string;
      readonly tone: ReviewTone;
      readonly stamps: readonly { seat: number; caption: string }[];
      readonly byline: string | null;
    }
  /** 统计条：狼杀 1 · 毒杀 0 · 救活 1 · 查验 1 / 成功 3 · 失败 2。 */
  | { readonly kind: 'stats'; readonly items: readonly { label: string; value: string }[] }
  /** 分节标题：「关键行动」「全员身份」「任务进程」。 */
  | { readonly kind: 'section'; readonly title: string }
  /** 分组行：左侧色轨 + 组标题 + 右上标签 + 若干行（可淡化）+ 脚注。狼人杀行动组、阿瓦隆每轮提案。 */
  | {
      readonly kind: 'groups';
      readonly groups: readonly {
        readonly title: string;
        readonly railTone: ReviewTone;
        readonly tag: { text: string; tone: ReviewTone } | null;
        readonly rows: readonly { cells: readonly ReviewInline[]; isDimmed: boolean }[];
        readonly footnote: string | null;
      }[];
    }
  /** 身份墙：座位徽章 + 名字 + 身份 + 状态。 */
  | {
      readonly kind: 'roster';
      readonly rows: readonly {
        readonly seat: number;
        readonly name: string;
        readonly role: string;
        readonly roleTone: ReviewTone;
        readonly status: string;
        readonly statusTone: ReviewTone;
      }[];
    }
  /** 键值事实：平民词 / 卧底词 / 投票方式 / 否决上限。 */
  | { readonly kind: 'facts'; readonly items: readonly { label: string; value: string }[] }
  /** 顺序步骤：出局顺序、湖仙查验、回合序列。 */
  | {
      readonly kind: 'timeline';
      readonly steps: readonly {
        readonly title: string;
        readonly tone: ReviewTone;
        readonly lines: readonly (readonly ReviewInline[])[];
      }[];
    }
  /** 排名表：竞赛排名（并列同名次）由渲染器计算。 */
  | {
      readonly kind: 'scoreboard';
      readonly rows: readonly { seat: number; name: string; score: number; isBot: boolean }[];
    }
  /** 段落：故事正文；`isMissing` 渲染为「这一棒交了空白」。 */
  | { readonly kind: 'paragraph'; readonly text: string; readonly isMissing: boolean }
  /** 图片：画作。`load` 返回 data URI；渲染器负责加载/失败/重试并向导出闸门登记就绪。 */
  | {
      readonly kind: 'image';
      readonly assetId: string;
      readonly caption: string;
      readonly aspectRatio: number;
      readonly load: (signal: AbortSignal) => Promise<string>;
    };
```

块词汇是封闭的：渲染器 `switch (block.kind)` 穷举，`default` 走 `assertNever`。

### 4.3 渲染器与报告主题（平台实现）

| 模块                 | 职责                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportTheme.ts`     | 由 `nightReviewLayout.ts` 的 `NIGHT_REPORT_PALETTE` / `NIGHT_REPORT_MEDAL_SIZES` 升级而来：平面色（分带拼接不允许渐变）、`ReviewTone → 徽章/标签/色轨色` 映射、卡宽比 `0.88`。`NIGHT_REPORT_COLORS` 迁入 `@/theme` 改名 `REPORT_COLORS` |
| `ReviewDocumentView` | `({ document, pageIndex, mode: 'screen' \| 'export' })`。页眉（kicker / shareTitle / 页码 / 未完成戳）只在 `export` 模式渲染；其余像素两种模式相同                                                                                      |
| `ReviewBlockView`    | 每种块一个子组件；`SeatMedal`、`ReviewTag` 从狼人杀正文抽出成为共享原子                                                                                                                                                                 |
| `ReviewImageBlock`   | 用 `block.load` 取 data URI；加载中骨架、失败态「加载失败 · 点击重试」；通过 `useReviewAssetGate` 登记就绪/失败                                                                                                                         |

### 4.4 导出控制器（平台实现）

`useRoomReviewExport(document, { roomId, userId })` 吸收 `useNightReviewShare` 已验证的语义：

| 能力     | 规则                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 缓存键   | `canonicalJson({ roomId, userId, roundKey, document })`，`image.load` 以 `assetId` 代入。换局或内容变化即失效                                        |
| 并发     | 同一键内并发调用合并到同一个 in-flight capture                                                                                                       |
| 就绪闸门 | 所有页面的 `image` 块就绪后才允许截图；无图页面挂载两帧后就绪；任一图片失败 → 对话框内重试，不进入截图                                               |
| 截图选择 | 小程序：每页 `captureViewSegmentedPngBase64`；其余：每页 `captureViewPngBase64`。这是唯一的平台分支                                                  |
| 单页上限 | 高度 ≤ `SEGMENTED_CAPTURE_BAND_HEIGHT_PX × 8`，超出抛错；游戏应把长内容拆页                                                                          |
| 运行阶段 | `null \| { phase: 'preparing' } \| { phase: 'capturing'; done; total } \| { phase: 'uploading' }`；`total` = 页数 × 该页带数；小程序才有 `uploading` |
| 取消     | 取消 token 按运行实例隔离：只断开 UI 接管，不中断已发出的截图/上传；完成的截图仍入缓存                                                               |
| 分发     | 统一 `shareImagesBase64(pages, shareTitle)`；小程序多页上传后 `wxPreviewImage(urls[0], urls)`                                                        |
| 结果     | `ReviewShareOutcome = 'handedOff' \| 'downloaded' \| 'previewed' \| 'cancelled' \| 'failed'`                                                         |

`shareImagesBase64` 改为返回 `ReviewShareOutcome`（现为 `void`，无法区分系统分享与下载回落）。`AbortError` → `cancelled`；删除按错误消息字符串判取消的逻辑。

### 4.5 容器与入口

| 组件                      | 职责                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoomReviewDialog`        | `RoomDialog` 外框 + 标题 + 多页页签（`pages.length > 1` 时）+ 滚动 `ReviewDocumentView(mode='screen')` + footer「保存／分享图片」（多页时附「仅本页 / 全部」） |
| `RoomReviewExportStage`   | 导出时隐藏挂载全部页面（`mode='export'`），每页一个 `collapsable={false}` 容器与 ref；仅在截图期间存在于树中                                                   |
| `RoomReviewProgressModal` | 由 `ShareProgressModal` 泛化；「正在准备 / 正在生成 n/N / 正在上传」+ 取消                                                                                     |

入口沿用现有动作框架，`RoomShellModel` 不加字段：

- `useRoomReview(contribution, state, viewer, roomCode)` 返回 `{ tool, hostAction, overlay }`。
- `tool`：`{ key: 'review', label: '本局复盘', audience: 'anyone' }`；`notEnded` → `null`；`notPermitted` → 禁用 + 原因。
- `hostAction`：同一 handler 的主持台 sheet 动作；终局任务 `choice: [review, next-round, return-lobby]`。狼人杀 `night-review` 步骤与分享提醒 note 不变。
- `overlay` 放入 `gameOverlays`。

## 5. 各游戏复盘内容

每个游戏一个纯函数 `src/games/<game>/review/to<Game>ReviewDocument.ts`。下面逐游戏写清「用户在复盘里看到什么」。
块名对应 §4.2；每页从上到下按列出顺序渲染；页眉（kicker / shareTitle / 页码）由平台在导出模式追加，不在此重复。

### 5.1 狼人杀 `werewolf`

- **事实来源**：`buildNightReviewData(gameState)`（保留为事实层，测试完整）→ 新增映射 `toWerewolfReviewDocument(data, roomCode)`。
- **可用条件**：`GameStatus.Day | Ended`；且本座位在服务端 `allowedSeats` 内，否则 `notPermitted`（「房主尚未向你开放复盘」）。房主与旁观者按现有规则。
- **kicker**：`🌙 第一夜 · 夜报`；**footer**：`仅供裁判及观战者参考 · 本夜报由对局记录自动生成`。
- **1 页**：
  1. `hero`：`昨夜平安夜` / `昨夜 N 人出局`；`stamps` = 出局座位 + 死因（`狼杀出局` / `毒杀出局`）；`byline` = 狼队裁决（`狼队 3 票锁定` / `狼队全员空刀`）。
  2. `stats`：狼杀 / 毒杀 / 救活 / 查验。
  3. `section 关键行动` → `groups`：按阵营分组，`railTone` 狼 `evil` / 神 `special` / 民 `good` / 第三方 `highlight`；每组一个行动者；行 = 主语徽章 + 标签（`击杀成立` / `未行动`）+ 短语 + 目标徽章；未行动行 `isDimmed`；狼队组 `footnote` = 裁决语（`狼队目标不一致 — 按多数票击杀` 等）。
  4. `section 警长竞选`（有竞选时）→ `timeline`：上警 / 退水 / 投票 / 当选。
  5. `section 全员身份` → `roster`：座位 + 名字 + 角色（阵营色调）+ `存活` / `狼杀出局`。
- **不呈现**：整局胜负（Night-1 scope）。

### 5.2 阿瓦隆 `avalon`

- **事实来源**：`AvalonViewModel` 的 `resolveEndedInstruction`、`questResults`、`roundHistory`、`ladyHistory`、`seats[].role`、`config`。
- **可用条件**：`phase === 'ended'`。
- **kicker**：`🏰 第 ${gameSequence + 1} 局 · 终局`。
- **1 页**：
  1. `hero`：`AVALON_END_REASON_COPY[reason].title`（如 `好人阵营胜利`），`tone` 按胜方；`byline` = 刺杀行（`刺客 4 号指认 2 号（梅林）→ 命中`）或 `description`。
  2. `stats`：成功 N · 失败 N · 否决 N。
  3. `section 全员身份` → `roster`：角色（`梅林（好人）`），`roleTone` 按阵营。
  4. `section 本局配置` → `facts`：投票方式 / 否决上限 / 任务人数 / 湖仙 / 角色配置。
  5. `section 湖仙查验`（≥ 9 人）→ `timeline`：每轮 `持有人 → 被查者 · 好人/坏人`，未发生轮写原因。
  6. `section 任务进程` → `groups`：每个任务一组，`railTone` 成功 `good` / 失败 `evil`，`tag` = `成功` / `失败 ×N`；行 = 每次提案：队长徽章 + 队员徽章 + 赞成/反对计数 + `通过` / `否决` 标签；被否决提案 `isDimmed`。
- **删除**：`AvalonReviewOverlay` 及其样式表、`AvalonRecordLakeSection` / `AvalonRecordRound` / `AvalonRecordTrack` 若仅被复盘使用（对局记录 overlay 若也用则保留）。

### 5.3 谁是卧底 `undercover`

- **事实来源**：`state.winner`、`round.civilianWord` / `undercoverWord` / `wordPair.category` / `roles` / `revelations`、`config.hasBlank`。
- **可用条件**：`phase === 'ended'`；`phase === 'aborted' && round !== null` → `isAborted: true`，`hero` 改为 `本局中止`。
- **kicker**：`🕵️ 第 N 局 · 终局`。
- **1 页**：
  1. `hero`：`${UNDERCOVER_ROLE_NAMES[winner]}获胜`，`tone` 平民 `good` / 卧底 `evil` / 白板 `special`；`stamps` = 出局座位（按顺序）。
  2. `facts`：平民词 / 卧底词 / 词语分类 / 是否有白板。
  3. `section 全员身份` → `roster`：平民 / 卧底 / 白板 + `存活` / `第 k 个出局`。
  4. `section 出局顺序` → `timeline`：每步 `座位徽章 + 身份标签`。
- **删除**：`UndercoverRoomScreen` 座位盘上方内联 `undercover-results` 段。

### 5.4 瞎掰王 `fibking`

- **事实来源**：`round.word` / `definition.coreMeaning` / `definition.usageNote` / `roles.guesserSeat` / `roles.honestSeat` / `guesses`。
- **可用条件**：`phase === 'ended'`。
- **kicker**：`💡 第 N 局 · 终局`。
- **1 页**：
  1. `hero`：词语本身作为大标题；`byline` = 大聪明是否选中老实人（`大聪明选中了老实人` / `大聪明被瞎掰者骗过`，由 `guesses` 中是否含 `honestSeat` 推导）。
  2. `facts`：核心释义 / 用法说明。
  3. `section 全员身份` → `roster`：大聪明 `highlight` / 老实人 `good` / 瞎掰者 `evil`。
  4. `section 点选记录` → `timeline`：大聪明每次点选的座位与揭示身份，按顺序。
- **新增**，无删除。

### 5.5 经典你画我猜 `drawguess`

本游戏是唯一需要**服务端改动**的：现有 `ended` 只保留 `totalScores`，每轮题目、画作、猜中记录在下一回合被清空（§1、§10）。用户决定补齐逐轮画作，设计如下。

**引擎（`packages/game-engine/src/games/drawguess/`）**

```ts
export interface DrawGuessTurnRecord {
  readonly turnIndex: number;
  readonly drawerSeat: number;
  readonly word: string;
  /** 猜中座位按猜中先后；未猜中者不在列。 */
  readonly guessedSeats: readonly number[];
  readonly roundScores: Readonly<Record<number, number>>;
  /** roundEnd 内已入册的终稿；画手未上传则为 null，复盘用笔画回放兜底不在本设计内 → 显示「未提交画作」。 */
  readonly entryId: string | null;
  readonly pngEntry: DrawGuessMedia | null;
}
// DrawGuessState 新增
readonly turnHistory: readonly DrawGuessTurnRecord[];
```

- `evolve`：`drawguess.turn.started`（关闭上一轮 `roundEnd` 时）与 `drawguess.game.ended` 把当前 `roundEnd` 快照 push 进 `turnHistory`；`drawguess.game.started` 与 `drawguess.game.abort` 清空。
- `DRAWGUESS_STATE_VERSION` v2 → v3，`parseState` 为 v2 持久化状态显式迁移 `turnHistory: []`（正式 migration，不是运行时 fallback）。
- `visibility`：`turnHistory` 公开（终局身份、题目全公开）。

**Worker（`packages/api-worker/src/games/drawguess/mediaRoutes.ts`）**

- `GET /:roomCode/media/:entryId` 现只允许 `roundEnd` 读当前轮；改为：`roundEnd` 读当前轮，`ended` 读 `turnHistory` 内任一 `entryId`。访问控制不变（房间成员）。
- R2 `drawguess/` 前缀 48 小时生命周期不变；房间本身也在同一量级过期。复盘内图片加载 404 → 图片块显示 `画作已过期`，不阻塞其他页导出。

**可用条件**：`phase.kind === 'ended'`。**kicker**：`🎨 第 N 局 · 终局`。

**1 + T 页**（T = `turnHistory.length`，典型 6 人 × 2 = 12）：

- 第 1 页：`hero`（`第一名 ${name}`，`stamps` = 前三名座位 + `第 k 名`）→ `scoreboard`（竞赛排名，机器人标记）。
- 第 1 + k 页（`label` = `第 k 轮 · ${drawer} 画「${word}」`）：`image`（`load` 包 `drawGuessMediaTransport.readDrawingDataUri(roomCode, entryId, null)`；`entryId === null` → `paragraph.isMissing`「未提交画作」）→ `facts`（题目 / 画手 / 猜中人数）→ `timeline`（猜中顺序：座位徽章 + `+分数`）。
- 多页导出默认「全部」，对话框提供「仅本页」。

**保留**：`DrawGuessEndedView` 舞台内 `最终排名`（房间内即时反馈）；复盘第 1 页与它共用 `DrawGuessScoreboard` 的排序函数，不共用组件。

### 5.6 你画我猜接龙 `pictionary`

- **事实来源**：`state.chains`、`participants`、`roundNumber`、`phase`。
- **可用条件**：`phase === 'ended' | 'aborted'`（`aborted` → `isAborted`）。
- **kicker**：`🖼️ 第 ${roundNumber} 轮 · 画册`。
- **N 页**（每篇画册一页，`label` = `第 k 篇 · ${originSeat 名字} 的画册`）：
  1. `section`：起手词（首个 `text` 条目）。
  2. 按棒交替：`image`（`load` 包 `pictionaryMediaTransport.readDrawingDataUri(roomCode, entryId, null, signal)`，`caption` = `第 k 棒 · 作者`）/ `paragraph`（猜词）；缺棒 `paragraph.isMissing`。
  3. 空册：单个 `paragraph.isMissing`「本册尚无已提交作品」。
- 画廊内「分享本篇画册」按钮改为打开复盘并定位到该页。
- **删除**：`PictionaryAlbumExport`（其图片加载/重试逻辑由平台 `ReviewImageBlock` 承担）。

### 5.7 故事接龙 `storyrelay`

- **事实来源**：`getStoryRelayVisibleStories(state)`、`participants`、`roundNumber`、`completedAt`。
- **可用条件**：`phase === 'ended' | 'aborted'`。
- **kicker**：`📖 第 ${roundNumber} 轮 · 故事`。
- **N 页**（每篇故事一页，`label` = `第 k 篇故事`）：每棒一组 `section`（`第 k 棒 · 作者`）+ `paragraph`（正文；空白棒 `isMissing`）。
- 画廊内「分享本篇故事」按钮改为打开复盘并定位到该页。
- **删除**：`StoryRelayImageShare`、`useStoryRelayImageShare`。

### 5.8 示例 `demo` 与新游戏模板

- `phase === 'ended'` → `hero`（`本局结束`）+ `roster`（参与者，`role` = `参与者`，`status` = `完成`）。
- 生成器模板 `review/to__GAME_PASCAL__ReviewDocument.ts.tmpl` 以此为骨架，带 `TODO(gameplay)`。

### 5.9 汇总

| 游戏       | 页数  | 用到的块                                        | 服务端改动             | 删除的现有代码                                    |
| ---------- | ----- | ----------------------------------------------- | ---------------------- | ------------------------------------------------- |
| werewolf   | 1     | hero stats section groups timeline roster       | 无                     | §8.2                                              |
| avalon     | 1     | hero stats section roster facts timeline groups | 无                     | `AvalonReviewOverlay`                             |
| undercover | 1     | hero facts section roster timeline              | 无                     | 内联结果段                                        |
| fibking    | 1     | hero facts section roster timeline              | 无                     | —                                                 |
| drawguess  | 1 + T | hero scoreboard image facts timeline paragraph  | 引擎 + Worker 媒体路由 | —                                                 |
| pictionary | N     | section image paragraph                         | 无                     | `PictionaryAlbumExport`                           |
| storyrelay | N     | section paragraph                               | 无                     | `StoryRelayImageShare`、`useStoryRelayImageShare` |
| demo       | 1     | hero roster                                     | 无                     | —                                                 |

十种块全部被至少一个游戏使用；没有游戏需要词汇之外的表达。

## 6. 平台矩阵

| 平台                | 截图             | 分发                                                 | 可能结果                                 |
| ------------------- | ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| 浏览器（HTTPS）     | html2canvas 整图 | `navigator.share({ files })`；不支持/被拒 → 逐页下载 | `handedOff` / `downloaded` / `cancelled` |
| 浏览器（HTTP）      | 同上             | Web Share 不可用 → 逐页下载                          | `downloaded`                             |
| 微信小程序 web-view | html2canvas 分带 | 上传 `/share/image` → `wx.previewImage` 多图         | `previewed` / `failed`                   |
| iOS / Android       | `captureRef`     | `expo-sharing` 逐页                                  | `handedOff` / `cancelled`                |

反馈：`handedOff` 不提示；`downloaded` toast「图片已保存」；`previewed` 不提示；`cancelled` 不提示；`failed` 见 §7。

## 7. 失败处理

| 失败                                    | 日志                     | Sentry | UI                                            |
| --------------------------------------- | ------------------------ | ------ | --------------------------------------------- |
| 图片加载失败（画作读取/解码）           | `roomScreenLog.warn`     | 否     | 图片块内「加载失败 · 点击重试」；导出按钮禁用 |
| 截图抛错                                | `roomScreenLog.error`    | 是     | toast「无法生成战报截图，请重试」             |
| 单页高度超上限                          | 开发期抛错               | 是     | 契约测试拦截，不进入导出                      |
| `/share/image` 上传失败                 | 401 `warn`，其余 `error` | 非 401 | alert「分享失败」「无法上传图片，请稍后重试」 |
| Web Share `AbortError`                  | 无                       | 否     | 无                                            |
| Web Share `NotAllowedError`/`TypeError` | `warn`                   | 否     | 回落下载 + toast「图片已保存」                |
| 终局事实缺失（`winner` 空、座位无角色） | 构造期抛错               | 是     | 房间完整性错误路径                            |
| 未知块类型                              | `assertNever`            | —      | 编译期拦截                                    |

## 8. 重建步骤

每步独立可验证、可 review。步骤 1 完成前不动任何游戏。

### 8.1 平台层（新建）

`src/features/room/review/`：`types.ts`（§4.1–4.2）、`reportTheme.ts`、`ReviewDocumentView.tsx` + 各块子组件、`useReviewAssetGate.ts`、`useRoomReviewExport.ts`、`RoomReviewDialog.tsx`、`RoomReviewExportStage.tsx`、`RoomReviewProgressModal.tsx`、`useRoomReview.ts`。`shareImage.ts` 返回 `ReviewShareOutcome`。`NIGHT_REPORT_COLORS` → `@/theme` `REPORT_COLORS`。

### 8.2 狼人杀（替换）

| 删除                                                                                                                                                                          | 保留                                                                                                          | 新增                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `NightReviewModal`、`NightReviewShareCard`、`NightReviewReportBody`、`nightReviewLayout.ts`、`shareNightReview.ts`、`useNightReviewShare.ts`、`ShareProgressModal` 及对应测试 | `NightReview.helpers.ts`（事实提取与其测试）、`ShareReviewModal`（服务端授权 UI）、`useRoomModals` 的授权状态 | `src/games/werewolf/review/toWerewolfReviewDocument.ts` + 测试 |

`nightReviewLayout.ts` 的文案常量（`NIGHT_REPORT_KICKER`、裁决语、标签等）迁入 `toWerewolfReviewDocument.ts`；配色迁入 `reportTheme.ts`。

### 8.3 其他游戏（替换 / 新增）

| 游戏       | 删除                                                      | 新增                                                                                                    |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| avalon     | `AvalonReviewOverlay` + 样式 + 测试；`reviewVisible` 状态 | `review/toAvalonReviewDocument.ts`                                                                      |
| pictionary | `PictionaryAlbumExport`                                   | `review/toPictionaryReviewDocument.ts`（`image.load` 包 `pictionaryMediaTransport.readDrawingDataUri`） |
| storyrelay | `StoryRelayImageShare`、`useStoryRelayImageShare`         | `review/toStoryRelayReviewDocument.ts`                                                                  |
| undercover | 座位盘上方内联 `undercover-results` 段                    | `review/toUndercoverReviewDocument.ts`                                                                  |
| drawguess  | 无（`DrawGuessEndedView` 舞台内排名保留）                 | `review/toDrawGuessReviewDocument.ts`（依赖 §8.5 先完成）                                               |
| fibking    | —                                                         | `review/toFibReviewDocument.ts`                                                                         |
| demo       | —                                                         | 模板骨架                                                                                                |

### 8.4 模板与契约

- `defineClientGameModule` 的 `review` 设为必填；`scripts/lib/new-game/templates` 增加 `review/to__GAME_PASCAL__ReviewDocument.ts.tmpl` 与测试模板。
- 新增 `src/__tests__/roomReview.contract.test.ts`（§9.1）。
- 更新 [room-shell-contract.md](room-shell-contract.md) Host Task 表终局行、[multigame-platform-design.md](multigame-platform-design.md) §25 清单第 6 条。

### 8.5 经典画猜 `turnHistory`（服务端，可与 8.1 并行）

独立 PR，先于 8.3 的 drawguess 行合入；不依赖复盘平台层。

1. 引擎：`DrawGuessTurnRecord` + `DrawGuessState.turnHistory`（§5.5）；`evolve` 四个事件点；`parseState` v3 与 v2 → v3 迁移；`visibility` 公开；`engine.test.ts` 补：完整两轮后 `turnHistory.length === 2`、中止清空、再来一局清空、迁移 v2 fixture。
2. Worker：`mediaRoutes.ts` GET 在 `ended` 阶段按 `turnHistory` 解析 `entryId → objectKey`；`mediaRoutes.test.ts` 补终局读取与非成员 403。
3. 客户端：`drawGuessMediaTransport.readDrawingDataUri` 签名不变。
4. 文档：[drawguess-game-design.md](drawguess-game-design.md) §状态模型与 §8.1 R2 补 `turnHistory` 与终局读取。

## 9. 测试与验收

重建后测试重心从「两份 JSX 是否一致」变为「文档数据是否正确」+「渲染器是否正确」，二者正交。

### 9.1 契约测试（跨游戏，穷举 `GAME_TYPES`）

- lobby fixture → `notEnded`；ended fixture → `available` 且 `pages.length ≥ 1`、每页 `blocks.length ≥ 1`。
- 同一 fixture 两次 `resolve` 结构相等；改 `roundKey` 来源字段后不等。
- 文档可 `canonicalJson`（`image.load` 以 `assetId` 代入）。
- 每页在 jsdom 布局 mock 下高度 ≤ 上限。

### 9.2 游戏级（纯数据断言，无 RN 渲染）

- `toXReviewDocument(state)` 断言块序列与关键事实：胜方、身份、词语、排名、出局顺序。
- 狼人杀：现有 `NightReviewShareCard.test.tsx` 的事实用例（狼队共同目标、空刀不出现 0 号、未行动淡化行、身份墙恰一人出局）迁为 `toWerewolfReviewDocument.test.ts` 的数据断言。

### 9.3 渲染器（一次性）

- 每种块一个渲染测试；`mode='screen'` 与 `mode='export'` 的文本序列只差页眉。
- `scoreboard` 竞赛排名并列；`image` 加载/失败/重试与就绪闸门。

### 9.4 导出控制器

- 缓存键随 `roundKey`/`userId`/内容变化；并发合并；取消不中断截图；三端 `ReviewShareOutcome` 映射；小程序 `uploading` 阶段。

### 9.5 E2E

- `werewolf-night-flow` 复盘分享步骤保持通过。
- 新增：谁是卧底终局 → 打开复盘 → 导出 → 断言下载 `undercover-<roomCode>-<roundTag>.png` 非空。
- 画册多页：断言 `-p1` / `-p2` 两个文件。

### 9.6 人工验收

按 [room-shell-contract.md](room-shell-contract.md) 验收矩阵 Overlays / Recovery-results 行，窄屏与桌面各一遍：长内容滚动、多页页签、导出中取消、图片失败重试、小程序分带进度。

## 10. 决策记录与开放问题

| 决策                              | 结论                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 增量迁移还是完全重建              | 完全重建（用户决定 2026-10-29）。增量方案要求每个游戏写 `Body` 组件并靠测试对齐两容器；声明式文档让一致性由构造保证，新游戏只填数据 |
| 组件式正文还是声明式文档          | 声明式。代价是块词汇封闭、需要先扩词汇再表达新内容；收益是单一渲染器、纯数据测试、可序列化缓存键                                    |
| 块词汇是否允许逃生口              | 不允许。`custom` 块会在一年内让每个游戏重新长出自己的 JSX                                                                           |
| 色调用游戏词还是语义词            | 语义词（`good / evil / special / out / highlight`）。`wolf / god` 是狼人杀词汇，不能进平台                                          |
| 是否做只读战报链接 / 存档         | 否。需要时另起设计。声明式文档是可序列化的，届时服务端存档可直接存文档 JSON                                                         |
| 分页由谁决定                      | 游戏按语义分页，平台只校验上限                                                                                                      |
| 狼人杀逐座位授权是否上提          | 否。映射为 `notPermitted`；其他游戏终局身份全公开                                                                                   |
| `shareImagesBase64` 返回值        | 必须改为 `ReviewShareOutcome`                                                                                                       |
| 文档构建放 game-engine 还是客户端 | 客户端 `src/games/<game>/review/`。构建器是纯函数但依赖客户端的中文展示名（如 `avalonRoleDisplay`）；无服务端消费者时不进引擎       |

已决问题（2026-10-29，用户拍板）：

1. **经典画猜逐轮画作**：做。服务端新增 `turnHistory`（§5.5、§8.5），复盘为 1 + T 页。
2. **瞎掰王复盘内容**：词 + 释义 + 身份分配 + 点选记录（§5.4）足够。
3. **块词汇首版**：十种够用；阿瓦隆每轮提案用 `groups` 表达（§5.2）。不加 `ballot` 块。

开放问题：

1. **导出时间戳**：页眉「生成时间」用客户端时钟；仅 storyrelay / pictionary 有服务端 `completedAt`。实施时默认客户端时钟，不阻塞。
2. **经典画猜画作过期**：R2 `drawguess/` 48 小时生命周期下，超时后复盘图片块显示「画作已过期」。是否延长生命周期由运维成本决定，不在本设计内。

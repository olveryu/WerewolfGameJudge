# 跨游戏本局复盘与图片分享设计

> 状态：已实施（v3，2026-11-06）。方向：**完全重建**，现有各游戏的复盘/导出组件已删除。§1 记录实施前现状供追溯；§3–§9 已按实施结果更新，类型以 [`src/features/room/review/types.ts`](../src/features/room/review/types.ts) 为准；决策见 §10，与设计稿 v2（2026-10-29）的差异及理由见 §11。
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
5. **新游戏零样板。** 生成器模板带复盘骨架与真实引擎局面（`src/test-utils/<gameId>State.ts` 的 `<GAME>_REVIEW_ROUNDS`），并登记进跨游戏契约；`review` 必填，缺复盘的游戏编译不过。

### 2.2 非目标

- 不做独立只读战报链接、不做战报持久化。`/share/image` 仍是一天过期的临时预览图。
- 不改游戏规则、阶段机、服务端权限模型。狼人杀逐座位授权保持原样。
- 不替换 html2canvas / view-shot / expo-sharing。
- 服务端改动仅限经典画猜 `turnHistory`（§5.5、§8.5）；其余游戏终局状态已足够。

## 3. 设计原则

1. **游戏拥有事实与文案，平台拥有版式与流程。** 文档里的事实文案由游戏给出，复盘名、分享标题与通用页脚归平台（`reviewCopy.ts`）；文档的每个像素由平台画出。
2. **数据，不是组件。** `RoomReviewDocument` 可 `canonicalJson` 序列化（图片块的加载函数除外）。这让缓存键、单测、快照都变成纯数据比较。
3. **块词汇有限且封闭。** 渲染器只认 §4.2 列出的块类型；游戏需要新表达时先扩词汇再用，不允许「自定义 JSX 块」逃生口。
4. **导出的是完整文档。** 分页单元由游戏按语义声明（一篇画册、一篇故事、一轮）；超长单元由平台按估高切成编号续页，不按像素硬切；运行期仍校验单页高度上限。
5. **结果诚实。** 区分「交给系统分享面板」「下载」「微信预览」「取消」「失败」。
6. **Fail fast。** 终局缺少应有事实（`winner` 为空、座位无角色）是构造错误，抛错而非占位。

## 4. 契约

全部位于 `src/features/room/review/`。game-engine 只为经典画猜新增 `turnHistory`（§5.5）。

### 4.1 复盘贡献（游戏实现）

```ts
/** defineClientGameModule({ review }) 必填；房间页把它作为 prop 交给游戏的 RoomScreen。 */
export interface RoomReviewContribution<TState> {
  readonly resolve: (input: RoomReviewInput<TState>) => RoomReviewAvailability;
}

export interface RoomReviewInput<TState> {
  readonly state: TState;
  readonly viewer: RoomViewer;
  readonly roomCode: string;
}

export type RoomReviewAvailability =
  | { readonly kind: 'notEnded' } // 入口不渲染
  | { readonly kind: 'notPermitted'; readonly reason: string } // 入口禁用 + 原因（狼人杀未授权座位）
  | {
      readonly kind: 'available';
      readonly document: RoomReviewDocument;
      readonly sharing: RoomReviewSharing; // 能读不一定能分享（狼人杀旁观者）
      readonly confirmation: RoomReviewConfirmation | null; // 打开前确认（狼人杀防剧透）
    };

export type RoomReviewSharing =
  | { readonly isAllowed: true }
  | { readonly isAllowed: false; readonly reason: string };

export interface RoomReviewDocument {
  /** 本局标识；进导出缓存作用域，换局即变，打开着的对话框随之关闭。 */
  readonly roundKey: string;
  readonly kicker: string; // 页眉：「🌙 第一夜 · 夜报」「🏰 第 3 局 · 终局」
  readonly fileStem: string; // `${gameType}-${roomCode}-${roundTag}`；无局号的游戏省略 roundTag；多页追加 `-p<n>`
  readonly footer: string; // REVIEW_GENERATED_FOOTER，或游戏自己的声明（狼人杀）
  readonly isAborted: boolean; // 中止局：页眉加「未完成」戳
  readonly pages: readonly RoomReviewPage[];
}

export interface RoomReviewPage {
  readonly key: string;
  readonly label: string | null; // 多页时每页必填（「第 1 篇 · 小明 的画册」），单页为 null
  readonly blocks: readonly ReviewBlock[];
}
```

平台独有的文案在 `reviewCopy.ts`，游戏不重复：对话框标题与入口、主持动作同名 `REVIEW_TITLE`「本局复盘」；导出页眉与系统分享标题 `formatReviewShareTitle(roomCode)`「房间 1234 战报」；通用页脚 `REVIEW_GENERATED_FOOTER`「本局复盘由对局记录自动生成」。

约束：`resolve` 为纯函数，同一输入两次调用结构相等。类型表达不了的结构规则由 `assertReviewDocument` 在解析处 fail fast：至少一页、页 key 唯一、每页至少一块、多页 ⇔ 每页有 `label`。

### 4.2 块词汇（封闭集合）

语义色调，不出现游戏词汇；游戏自己决定「狼人 → `evil`」「白板 → `special`」：

```ts
export type ReviewTone = 'neutral' | 'good' | 'evil' | 'special' | 'out' | 'highlight' | 'muted';

/** 行内：连续 text 连成一句（带色词留在句内）；seat 徽章与 tag 是独立元素。 */
export type ReviewInline =
  | { readonly kind: 'text'; readonly text: string; readonly tone: ReviewTone }
  | { readonly kind: 'seat'; readonly seat: number; readonly tone: ReviewTone }
  | { readonly kind: 'tag'; readonly text: string; readonly tone: ReviewTone };
```

| 块           | 用途                                                           | 字段                                                                                                                                                       |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero`       | 结论区                                                         | `headline`（`text` 与 `figure` 大号数字段，如「昨夜 <1> 人出局」）、`tone`、`stamps[{ seat, tone, title, caption, note }]`、`byline`                       |
| `stats`      | 统计条                                                         | `items[{ label, value }]`                                                                                                                                  |
| `section`    | 分节标题                                                       | `title`                                                                                                                                                    |
| `divider`    | 正文与附录之间的分隔                                           | —                                                                                                                                                          |
| `groups`     | 色轨分组（阿瓦隆任务进程）                                     | `groups[{ title, railTone, tag, rows[{ cells: ReviewInline[], isDimmed }], footnote }]`                                                                    |
| `roster`     | 身份墙                                                         | `columns: 1 \| 2`、`rows[{ seat, seatTone, name \| null, role, status, statusTone, isOut }]`                                                               |
| `facts`      | 键值事实                                                       | `items[{ label, value }]`                                                                                                                                  |
| `timeline`   | 虚线轨上的顺序步骤（第一夜、警长竞选、出局、点选、猜中、湖仙） | `steps[{ title \| null, tone, lines: ReviewInline[][] }]`                                                                                                  |
| `scoreboard` | 排名表                                                         | `rows[{ rank, seat, name, scoreText, tag }]`；名次（并列同名次）与分数文案由游戏给出                                                                       |
| `paragraph`  | 正文                                                           | `caption \| null`（印在正文上方的标签，如「第 2 棒 · 小明」）、`text`、`isMissing`                                                                         |
| `image`      | 画作                                                           | `assetId`、`caption`（印在图上方）、`aspectRatio`、`load(signal) → { kind: 'loaded', dataUri } \| { kind: 'unavailable', message }`；reject 为可重试的失败 |

块词汇封闭：渲染器 `switch (block.kind)` 穷举。表达不了的内容先扩词汇（§11 记录了实施中的扩展），不给游戏留 JSX 逃生口。

### 4.3 渲染器与报告主题（平台实现）

| 模块                    | 职责                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportTheme.ts`        | 报告配色（`@/theme` 的 `REPORT_COLORS` 语义槽位，平面色，分带拼接不允许渐变）、`ReviewTone` → 徽章 / 标签 / 色轨色、徽章尺寸、单页上限 `REVIEW_PAGE_MAX_HEIGHT` = `SEGMENTED_CAPTURE_BAND_HEIGHT_PX × 8`                                                                                              |
| `ReviewDocumentView`    | `({ document, pageIndex, mode: 'screen' })` 或 `({ …, mode: 'export', shareTitle })`。`export` 只多出页眉分享标题、多页的「页签 · n/N」与圆角；其余像素两种模式相同                                                                                                                                   |
| `ReviewBlockView`       | 每种块一个子组件（hero / timeline / groups / roster / scoreboard / image），共享原子 `SeatMedal`、`ReviewTag`（`ReviewAtoms.tsx`）                                                                                                                                                                    |
| `ReviewImageBlock`      | 用 `block.load` 取图：加载中占位；`unavailable` 印游戏给的说明，不阻塞导出；失败「加载失败 · 点击重试」。结果缓存在 `reviewAssetStore`（对话框与导出舞台共用），导出时向 `ReviewExportGate` 登记就绪 / 失败                                                                                           |
| `paginateReviewFlow.ts` | 长内容分页：游戏声明「必须同页」的组（一棒的标签与内容），平台按渲染 token 估高装页——文字按最窄页（每字一个全角）估，画作按最宽页估；预算 4000 让 3× 密度下最宽 iPhone 的整页仍在 WebKit 画布面积（约 1677 万像素）内。超长单元续页 key 为 `${key}:part-n`、`label` 追加「（m/n）」，首页沿用单元 key |

### 4.4 导出控制器（平台实现）

`useRoomReviewExport({ roomId, userId, shareTitle, document })`（`document` 为 null 表示此观看者不可导出）返回 `{ stageRequest, pageWidth, run, isSharing, readiness(pages), prepare(pages), share(pages), cancel }`：

| 能力     | 规则                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 缓存     | 每页一张 PNG；作用域键 `canonicalJson({ roomId, userId, pageWidth, shareTitle, document: serializeReviewDocument(document) })`，`image.load` 以 `assetId` 代入；任一变化即新的空作用域 |
| 页宽     | 导出页宽 = 对话框页宽 `resolveRoomDialogWidth(windowWidth)`（窗宽 94%，上限 440），所见即所得                                                                                          |
| 并发     | 每个作用域同时只有一个截图任务；后来者加入，任务结束后补截仍缺的页                                                                                                                     |
| 就绪闸门 | 导出舞台挂载请求的页面：全部量到高度、全部图片就绪（或 `unavailable`）后再等两帧才截图；任一图片失败 → 拒绝本次请求，等读者在复盘里重试                                                |
| 截图选择 | 小程序：每页 `captureViewSegmentedPngBase64` 分带；其余：每页 `captureViewPngBase64` 整图。这是唯一的平台分支                                                                          |
| 单页上限 | 高度 > `REVIEW_PAGE_MAX_HEIGHT` → fail fast；长内容由游戏经 `paginateReviewUnit` 预先拆页                                                                                              |
| 预截图   | 对话框打开且允许分享时后台预截全部页（不提示）：iOS Safari 的 Web Share 需要点按的瞬时激活，点按时图片必须已在手里                                                                     |
| 运行阶段 | `null \| preparing \| capturing(done, total) \| uploading`；`total` = 各页带数之和；只有小程序有 `uploading`。对话框里显示在分享区，无对话框的运行（主持台直接分享）显示进度弹窗       |
| 取消     | 只断开 UI：截图继续并入缓存；已发出的上传照常完成，但不再打开预览                                                                                                                      |
| 分发     | 非小程序 `shareImagesBase64(images, shareTitle)`；小程序 `uploadShareImages` → `previewUploadedImages`                                                                                 |
| 结果     | `ShareImageOutcome = 'handedOff' \| 'downloaded' \| 'previewed' \| 'cancelled'`；失败抛错（§7）                                                                                        |
| 文件名   | 单页 `${fileStem}.png`；多页 `${fileStem}-p<n>.png`                                                                                                                                    |

`shareImagesBase64` 返回 `ShareImageOutcome`；取消只认 Web Share 的 `AbortError`（`isShareCancelled`），不再按错误消息字符串判断。

### 4.5 容器与入口

| 组件                      | 职责                                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoomReviewDialog`        | `RoomDialog`（`isContentFlush`，页面贴边）+ 标题 `REVIEW_TITLE` + 多页时副标题页签与「上一页 / 下一页」+ `ReviewDocumentView(mode='screen')` + 底部分享区：单页「保存／分享图片」；多页「保存／分享全部 N 页」+「仅分享本页」；不可分享时显示原因；截图中显示进度、可取消 |
| `RoomReviewExportStage`   | 截图期间在屏外挂载请求的页面（`mode='export'`），每页一个 `collapsable={false}` 容器与 ref；量高、等图、两帧后一次交回句柄                                                                                                                                                |
| `RoomReviewProgressModal` | 无对话框的运行用：「正在准备 / 正在生成 n/N / 正在上传」+ 取消                                                                                                                                                                                                            |

入口沿用现有动作框架，`RoomShellModel` 不加字段：

- `useRoomReview({ contribution, state, viewer, roomId, roomCode, onOpened })` 返回 `{ entry, open(pageKey | null), shareAll(), overlay }`；`resolve` 的文档先经 `assertReviewDocument`。
- `entry`：`notEnded` → `null`；`notPermitted` → `{ isEnabled: false, disabledReason }`；`available` → `{ isEnabled: true, onPress }`，有 `confirmation` 时先确认再打开。
- 游戏只通过 `buildReviewBottomButton(entry, variant)`（底部按钮，audience `anyone`）与 `buildReviewHostAction(entry)`（主持台动作，key `review`）摆放入口；终局任务用 `hostReviewClosingTask()`：`choice: [本局复盘, 再来一局, 返回大厅]`。狼人杀终局任务为 `[本局复盘, 授权玩家查看]`。
- `overlay` 放入 `gameOverlays`；`open(pageKey)` 让画廊「分享本篇」直接打开复盘并定位到该页；换局（`roundKey` 变化）时对话框自动关闭。

## 5. 各游戏复盘内容

每个游戏一个纯函数 `src/games/<game>/review/to<Game>ReviewDocument.ts`。下面逐游戏写清「用户在复盘里看到什么」。
块名对应 §4.2；每页从上到下按列出顺序渲染；页眉（kicker / 分享标题 / 页码）由平台在导出模式追加，不在此重复。下文的块序列与实际输出一致（契约测试的终局局面打印核对，2026-11-06）。

### 5.1 狼人杀 `werewolf`

- **事实来源**：引擎投影 `getWerewolfNightReview(state)`（#362 / #364 后的夜报数据，含警长竞选记录）→ `toWerewolfReviewDocument({ review, roomCode, gameSequence })`。
- **可用条件**：`GameStatus.Day | Ended`。房主与旁观者可读；入座玩家须在 `nightReviewAllowedSeats` 内，否则 `notPermitted`「房主尚未向你开放复盘」。只有房主与已授权座位可分享；旁观者可读不可分享（「仅房主和已获授权的玩家可以分享战报」）。所有读者打开前确认「查看本局复盘？」，Day 时提示可能影响警长竞选。
- **入口**：入口 → 防剧透确认 → 复盘对话框，底部即「保存／分享图片」。原先打开前的操作菜单已删除；「授权玩家查看」是独立的主持动作（`grant-review`）。
- **kicker**：`🌙 第一夜 · 夜报`；**footer**：`仅供裁判及观战者参考 · 本夜报由对局记录自动生成`；**文件名**：`werewolf-${roomCode}-${gameSequence + 1}.png`。
- **1 页**（保留 #364 的文字时间线版式）：
  1. `hero`：`昨夜平安夜` / `昨夜 <N> 人出局`（`figure`）；`stamps` = 出局座位 + 死因；`byline` = 狼队裁决。
  2. `section 第一夜` → `timeline`：每个行动一句（主语徽章 + 带色短语 + 目标徽章），步骤无标题。
  3. `section 警长竞选`（有竞选时）→ `timeline`：上警 / 退水 / 投票 / 当选，文案与面板共用 `sheriffElectionViewModel`。
  4. `divider` → `section 全员身份` → `roster`（双列）：角色按阵营着色、`存活` / 出局状态。
- **不呈现**：整局胜负（Night-1 scope）；统计条（时间线已逐条列出）。

### 5.2 阿瓦隆 `avalon`

- **事实来源**：`AvalonViewModel` 的 `resolveEndedInstruction`、`questResults`、`roundHistory`、`ladyHistory`、`seats[].role`、`config`。
- **可用条件**：`phase === 'ended'`。
- **kicker**：`🏰 第 ${gameSequence} 局 · 终局`（引擎的 `gameSequence` 发牌即从 1 起）；**文件名**：`avalon-${roomCode}-${gameSequence}.png`。
- **1 页**：
  1. `hero`：`AVALON_END_REASON_COPY[reason].title`（如 `好人阵营胜利`），`tone` 按胜方；`byline` = 刺杀行（`刺客 4 号指认 2 号（梅林）→ 命中`）或 `description`。
  2. `stats`：成功 N · 失败 N · 否决 N。
  3. `section 全员身份` → `roster`：角色（`梅林（好人）`），`roleTone` 按阵营。
  4. `section 本局配置` → `facts`：投票方式 / 否决上限 / 任务人数 / 湖仙 / 角色配置。
  5. `section 湖仙查验`（人数 ≥ `AVALON_LADY_MIN_PLAYERS`）→ `timeline`：每轮 `持有人 → 被查者 · 好人/坏人`，未发生轮写原因。
  6. `section 任务进程`（至少结算过一次投票时；刺客在首次投票前出手则无此节）→ `groups`：每个任务一组，`railTone` 成功 `good` / 失败 `evil`，`tag` = `成功` / `失败 ×N`；行 = 每次提案：队长徽章 + 队员徽章 + 赞成/反对计数 + `通过` / `否决` 标签；被否决提案 `isDimmed`。
- **删除**：`AvalonReviewOverlay` 及其样式表与测试；对局记录与复盘共用的文案抽到 `room/avalonRecordCopy.ts`。

### 5.3 谁是卧底 `undercover`

- **事实来源**：`state.winner`、`round.civilianWord` / `undercoverWord` / `wordPair.category` / `roles` / `revelations`、`config.hasBlank`。
- **可用条件**：`phase === 'ended'`；`phase === 'aborted' && round !== null` → `isAborted: true`，`hero` 改为 `本局已中止`，且只呈现对局中已公开的事实（出局座位与其身份），按中止时的承诺不公开词语与未揭示的身份。
- **kicker**：`🕵️ 本局 · 终局`——状态没有局号，不印「第 N 局」；**文件名**：`undercover-${roomCode}.png`。
- **1 页**：
  1. `hero`：`${UNDERCOVER_ROLE_NAMES[winner]}获胜`，`tone` 平民 `good` / 卧底 `evil` / 白板 `special`；`stamps` = 出局座位（按顺序）。
  2. `facts`：平民词 / 卧底词 / 词语分类 / 是否有白板。
  3. `section 全员身份` → `roster`：平民 / 卧底 / 白板 + `存活` / `第 k 个出局`。
  4. `section 出局顺序` → `timeline`：每步 `座位徽章 + 身份标签`。
- **删除**：`UndercoverRoomScreen` 座位盘上方内联 `undercover-results` 段。

### 5.4 瞎掰王 `fibking`

- **事实来源**：`round.word` / `definition.coreMeaning` / `definition.usageNote` / `roles.guesserSeat` / `roles.honestSeat` / `guesses`。
- **可用条件**：`phase === 'ended'`。
- **kicker**：`💡 本局 · 终局`——状态没有局号；**文件名**：`fibking-${roomCode}.png`。
- **1 页**：
  1. `hero`：词语本身作为大标题；`byline` = 大聪明是否选中老实人（`大聪明选中了老实人` / `大聪明被瞎掰王骗过`，由 `guesses` 中是否含 `honestSeat` 推导）。
  2. `facts`：核心释义 / 用法说明。
  3. `section 全员身份` → `roster`：大聪明 `highlight` / 老实人 `good` / 瞎掰者 `evil`。
  4. `section 点选记录`（有点选时；房主在首次点选前揭晓则无此节）→ `timeline`：大聪明每次点选的座位与揭示身份，按顺序。
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
  /** 全员猜中致画手本轮清零时为 true。 */
  readonly drawerZeroed: boolean;
  /** roundEnd 内已入册的终稿（取自上传预留的 entryId）；画手未上传则为 null，复盘用笔画回放兜底不在本设计内 → 显示「未提交画作」。 */
  readonly entryId: string | null;
  /** 与 entryId 同为 null 或同时存在。 */
  readonly pngEntry: DrawGuessMedia | null;
}
// DrawGuessState 新增
readonly turnHistory: readonly DrawGuessTurnRecord[];
// roundEnd 阶段新增（结算时取自 drawing.guessedSeats，供记录保留猜中先后）
readonly guessedSeats: readonly number[];
```

- `evolve`：`drawguess.turn.started`（关闭上一轮 `roundEnd` 时）与 `drawguess.game.ended` 把当前 `roundEnd` 快照 push 进 `turnHistory`；`drawguess.game.started`（开局、再来一局）与 `drawguess.game.returnedToLobby`（`drawguess.game.abort` 中止整局与 `drawguess.game.returnToLobby` 返回大厅共用此事件）清空。
- `DRAWGUESS_STATE_VERSION` v3 → v4，`migratePersistedDrawGuessState` 为 v3 持久化状态显式迁移 `turnHistory: []`，并为进行中的 `roundEnd` 按 `roundScores` 重建 `guessedSeats`；v1/v2 经同一链路升到 v4（正式 migration，不是运行时 fallback）。
- `visibility`：`turnHistory` 公开（终局身份、题目全公开），`DrawGuessViewModel.turnHistory` 对所有观看者原样投影。客户端从 `@game-judge/game-engine/games/drawguess/public` 引入 `DrawGuessTurnRecord`。

**Worker（`packages/api-worker/src/games/drawguess/mediaRoutes.ts`）**

- `GET /:roomCode/media/:entryId` 现只允许 `roundEnd` 读当前轮；改为：`roundEnd` 读当前轮，`ended` 读 `turnHistory` 内任一 `entryId`。访问控制不变（房间成员）。
- R2 `drawguess/` 前缀 48 小时生命周期不变；房间本身也在同一量级过期。已入册（当前轮或 `turnHistory` 内）但 R2 对象已过生命周期的终稿答 410「画作已过期」——如实的永久缺失，不是服务端错误；`entryId` 不在可读范围 → 404「画作不存在」；未入座 → 403「请先入座」。复盘图片块：410 → `unavailable`「画作已过期」，403 → `unavailable`「入座的玩家才能查看画作」（观战者），二者都不阻塞导出；其余失败可重试。

**可用条件**：`phase.kind === 'ended'`。**kicker**：`🎨 第 N 局 · 终局`。

**1 + T 页**（T = `turnHistory.length`，典型 6 人 × 2 = 12）：

- 第 1 页（`label` = `最终排名`）：`hero`（`第一名 ${name}`，并列第一时全列、以「、」分隔；`stamps` = 名次 ≤ 3 的座位（并列同名次全收）+ `第 k 名` + 总分）→ `scoreboard`（竞赛排名，`12 分`，机器人标「机器人」）。
- 第 1 + k 页（`label` = `第 k 轮 · ${drawer} 画「${word}」`，k = `turnIndex + 1`）：`image`（`load` 包 `drawGuessMediaTransport.readDrawingDataUri(roomCode, entryId, null, signal)`；`entryId === null` → `paragraph.isMissing`「未提交画作」）→ `facts`（题目 / 画手 / 猜中人数；全员猜中清零时附「全员猜中」说明）→ 有人猜中时 `section`「猜中顺序」+ `timeline`（座位徽章 + 名字 + `+分数 分`）。
- `turnHistory` 为空（v3 迁移来的房间）时只有第 1 页，`label` 为 null。
- 多页导出默认「全部」，对话框提供「仅本页」。

**保留**：`DrawGuessEndedView` 舞台内 `最终排名`（房间内即时反馈）；复盘第 1 页与它共用竞赛排名函数 `rankDrawGuessScores`（`src/games/drawguess/model/drawGuessResults.ts`，自 `DrawGuessScoreboard` 抽出），不共用组件。

### 5.6 你画我猜接龙 `pictionary`

- **事实来源**：`state.chains`、`participants`、`roundNumber`、`phase`。
- **可用条件**：`phase === 'ended' | 'aborted'`（`aborted` → `isAborted`）。
- **kicker**：`🖼️ 第 ${roundNumber} 轮 · 画册`。
- **每篇画册一个单元**（`label` = `第 k 篇 · ${originSeat 名字} 的画册`，key = chain id），每棒一组、标签印在内容上方：
  1. 起手词与每次猜词：`paragraph`，`caption` = `第 k 棒 · 作者`。
  2. 画作：`image`（`load` 包 `pictionaryMediaTransport.readDrawingDataUri`，`caption` = `第 k 棒 · 作者`）。R2 对象已过期 → Worker 答 410 `PICTIONARY_MEDIA_EXPIRED` → `unavailable`「画作已过期」，不阻塞导出。
  3. 缺棒：`paragraph.isMissing`「这一棒交了空白」；空册：单个 `paragraph.isMissing`「本册尚无已提交作品」。
- **分页**：`paginateReviewUnit` 把超长画册（20 人、每句 512 字）切成「（m/n）」续页，首页沿用画册 key。
- 画廊「分享本篇画册」打开复盘并定位到该篇首页。
- **删除**：`PictionaryAlbumExport`（图片加载 / 重试由平台 `ReviewImageBlock` 承担）。

### 5.7 故事接龙 `storyrelay`

- **事实来源**：`getStoryRelayVisibleStories(state)`、`participants`、`roundNumber`。
- **可用条件**：`phase === 'ended' | 'aborted'`。
- **kicker**：`📖 第 ${roundNumber} 轮 · 故事`。
- **每篇故事一个单元**（`label` = `第 k 篇故事`，key = chain id）：每棒一段 `paragraph`，`caption` = `第 k 棒 · 作者`，保留原文换行；空白棒 `isMissing`「（空白）」；未收到任何稿件的故事为单个 `paragraph.isMissing`「这篇故事尚未收录稿件」。
- **分页**：同 §5.6，超长故事切成编号续页（20 人 × 512 字可达约 1.7 万像素高，超过单页上限与 iOS 画布）。
- 画廊「分享本篇故事」打开复盘并定位到该篇首页。
- **删除**：`StoryRelayImageShare`、`useStoryRelayImageShare`。

### 5.8 示例 `demo` 与新游戏模板

- `phase === 'ended'` → `hero`（`本局结束`）+ `section 参与者` + `roster`（`role` = `参与者`，`status` = `完成`）；kicker `🎮 第 ${gameSequence} 局 · 终局`。
- 生成器模板 `review/to__GAME_PASCAL__ReviewDocument.ts.tmpl`、`review/__GAME_CAMEL__Review.ts.tmpl` 与测试模板以此为骨架；`scripts/lib/new-game/templates/game/src/test-utils/__GAME_ID__State.ts.tmpl` 生成真实引擎局面（满座大厅 / 开局 / 终局）与 `<GAME>_REVIEW_ROUNDS`，生成器把它登记进 `src/__tests__/roomReview.contract.test.ts`。

### 5.9 汇总

| 游戏       | 页数                 | 用到的块                                               | 服务端改动                           | 删除的现有代码                                    |
| ---------- | -------------------- | ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------- |
| werewolf   | 1                    | hero section timeline divider roster                   | 无                                   | §8.2                                              |
| avalon     | 1                    | hero stats section roster facts timeline groups        | 无                                   | `AvalonReviewOverlay`                             |
| undercover | 1                    | hero facts section roster timeline                     | 无                                   | 内联结果段                                        |
| fibking    | 1                    | hero facts section roster timeline                     | 无                                   | —                                                 |
| drawguess  | 1 + T                | hero scoreboard image paragraph facts section timeline | 引擎 `turnHistory` + Worker 媒体路由 | —                                                 |
| pictionary | 每篇画册 ≥ 1（续页） | paragraph image                                        | Worker 过期画作答 410                | `PictionaryAlbumExport`                           |
| storyrelay | 每篇故事 ≥ 1（续页） | paragraph                                              | 无                                   | `StoryRelayImageShare`、`useStoryRelayImageShare` |
| demo       | 1                    | hero section roster                                    | 无                                   | —                                                 |

## 6. 平台矩阵

| 平台                | 截图             | 分发                                                 | 可能结果                                 |
| ------------------- | ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| 浏览器（HTTPS）     | html2canvas 整图 | `navigator.share({ files })`；不支持/被拒 → 逐页下载 | `handedOff` / `downloaded` / `cancelled` |
| 浏览器（HTTP）      | 同上             | Web Share 不可用 → 逐页下载                          | `downloaded`                             |
| 微信小程序 web-view | html2canvas 分带 | 上传 `/share/image` → `wx.previewImage` 多图         | `previewed`；失败抛错                    |
| iOS / Android       | `captureRef`     | `expo-sharing` 逐页                                  | `handedOff`                              |

反馈：`handedOff` 不提示；`downloaded` toast「图片已保存」；`previewed` 不提示；`cancelled` 不提示；失败见 §7。原生分享面板不回报取消，因此原生端只有 `handedOff`。

## 7. 失败处理

| 失败                                              | 处理                        | UI                                                                                       |
| ------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 图片加载失败（画作读取 / 解码）                   | 图片块记为失败              | 图片块「加载失败 · 点击重试」；导出被拒，toast「有图片加载失败，请在复盘中点击图片重试」 |
| 画作已过期（410）/ 观战者无权看画（经典画猜 403） | `unavailable`，属预期结果   | 图片块印游戏的说明（「画作已过期」/「入座的玩家才能查看画作」），不阻塞导出              |
| 截图抛错                                          | `handleError`               | toast「无法生成战报截图，请重试」                                                        |
| 后台预截图失败（非图片原因）                      | 记日志，不打扰读者          | 下次点按「保存／分享」重试并给出反馈                                                     |
| 单页高度超上限                                    | 运行期 fail fast            | 由 `paginateReviewUnit` 预先拆页避免；越界即构造错误                                     |
| `/share/image` 上传失败（小程序）                 | `handleError`，401 属预期   | alert「无法上传图片，请稍后重试」                                                        |
| 系统分享失败（非取消）                            | `handleError`               | alert「无法分享图片，请稍后重试」                                                        |
| Web Share `AbortError`                            | `cancelled`                 | 无                                                                                       |
| Web Share `NotAllowedError` / `TypeError`         | 回落下载                    | toast「图片已保存」                                                                      |
| 终局事实缺失（`winner` 空、座位无角色）           | 构造期抛错                  | 房间完整性错误路径                                                                       |
| 文档结构违规（无页、重复 key、空页、页签不一致）  | `assertReviewDocument` 抛错 | 同上                                                                                     |
| 未知块类型                                        | 穷举 `switch`               | 编译期拦截                                                                               |

## 8. 重建步骤（已完成）

以下为实施时的步骤记录。

### 8.1 平台层（新建）

`src/features/room/review/`：`types.ts`、`reviewCopy.ts`、`reportTheme.ts`、`assertReviewDocument.ts`、`serializeReviewDocument.ts`、`reviewAssetStore.ts`、`paginateReviewFlow.ts`、`roomReviewActions.ts`、`useRoomReviewExport.ts`、`useRoomReview.tsx`，以及 `components/`（`ReviewDocumentView`、各块子组件、`ReviewAtoms`、`RoomReviewDialog`、`RoomReviewExportStage`、`RoomReviewProgressModal`）。`shareImage.ts` 返回 `ShareImageOutcome`（并拆出 `uploadShareImages` / `previewUploadedImages`）。`NIGHT_REPORT_COLORS` → `@/theme` `REPORT_COLORS`。`RoomDialog` 增加 `isContentFlush`，对话框宽度收敛为 `resolveRoomDialogWidth`。

### 8.2 狼人杀（替换）

| 删除                                                                                                                                                                                                                                    | 保留                                                                                                          | 新增                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `NightReviewModal`、`NightReviewShareCard`、`NightReviewReportBody`、`SheriffElectionReportSection`、`nightReviewLayout.ts`、`shareNightReview.ts`、`useNightReviewShare.ts`、`ShareProgressModal`、`useShareImageAction.ts` 及对应测试 | `NightReview.helpers.ts`（事实提取与其测试）、`ShareReviewModal`（服务端授权 UI）、`useRoomModals` 的授权状态 | `src/games/werewolf/review/toWerewolfReviewDocument.ts`、`werewolfReview.ts` 与测试 |

`nightReviewLayout.ts` 的文案常量迁入 `toWerewolfReviewDocument.ts`；配色迁入 `reportTheme.ts`；警长竞选的文案函数收敛到 `sheriffElectionViewModel`（面板与复盘共用）。

### 8.3 其他游戏（替换 / 新增）

| 游戏       | 删除                                                      | 新增                                                                                                    |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| avalon     | `AvalonReviewOverlay` + 样式 + 测试；`reviewVisible` 状态 | `review/toAvalonReviewDocument.ts`、`review/avalonReview.ts`；共用文案 `room/avalonRecordCopy.ts`       |
| pictionary | `PictionaryAlbumExport`                                   | `review/toPictionaryReviewDocument.ts`（`image.load` 包 `pictionaryMediaTransport.readDrawingDataUri`） |
| storyrelay | `StoryRelayImageShare`、`useStoryRelayImageShare`         | `review/toStoryRelayReviewDocument.ts`                                                                  |
| undercover | 座位盘上方内联 `undercover-results` 段                    | `review/toUndercoverReviewDocument.ts`；共用文案 `room/undercoverCopy.ts`                               |
| drawguess  | 无（`DrawGuessEndedView` 舞台内排名保留）                 | `review/toDrawGuessReviewDocument.ts`；排名函数 `model/drawGuessResults.ts`                             |
| fibking    | —                                                         | `review/toFibReviewDocument.ts`                                                                         |
| demo       | —                                                         | `review/toDemoReviewDocument.ts`，即模板骨架                                                            |

### 8.4 模板与契约

- `defineClientGameModule` 的 `review` 必填。生成器模板：`review/` 三件（文档构建、贡献、测试）与 `scripts/lib/new-game/templates/game/src/test-utils/__GAME_ID__State.ts.tmpl`（真实引擎局面与 `<GAME>_REVIEW_ROUNDS`）；生成器把新游戏登记进 `src/__tests__/roomReview.contract.test.ts`（第 16 处共享编辑）。
- 跨游戏契约 `src/__tests__/roomReview.contract.test.ts`（§9.1）。
- 已更新 [room-shell-contract.md](room-shell-contract.md) Host Task 表终局行与 Review 小节、[multigame-platform-design.md](multigame-platform-design.md) §25 清单第 6 条、[roomscreen-state-machine.md](roomscreen-state-machine.md) 弹窗表。

### 8.5 经典画猜 `turnHistory`（服务端，可与 8.1 并行）

独立 PR，先于 8.3 的 drawguess 行合入；不依赖复盘平台层。

1. 引擎：`DrawGuessTurnRecord` + `DrawGuessState.turnHistory`（§5.5）；`evolve` 四个事件点；`parseState` v4 与 v1/v2/v3 → v4 迁移；`visibility` 公开；`engine.test.ts` 补：完整两轮后 `turnHistory.length === 2`、中止清空、再来一局清空，`migration.test.ts` 补迁移 v3 fixture。
2. Worker：`mediaRoutes.ts` GET 在 `ended` 阶段按 `turnHistory` 解析 `entryId → objectKey`；`mediaRoutes.test.ts` 补终局读取与非成员 403。
3. 客户端：`drawGuessMediaTransport.readDrawingDataUri` 签名不变。
4. 文档：[drawguess-game-design.md](drawguess-game-design.md) §状态模型与 §8.1 R2 补 `turnHistory` 与终局读取。

## 9. 测试与验收

测试重心从「两份 JSX 是否一致」变为「文档数据是否正确」+「渲染器是否正确」，二者正交。

### 9.1 契约测试（跨游戏，穷举 `GameType`）

`src/__tests__/roomReview.contract.test.ts`：

- 注册表 `Record<GameType, …>` 穷举；每个游戏的局面来自 `src/test-utils/<gameId>State.ts` 的 `<GAME>_REVIEW_ROUNDS`（真实引擎打出的大厅 / 终局 / 下一局）。
- 大厅 → `notEnded`；终局 → 房主 `available` 且可分享、`assertReviewDocument` 通过、`fileStem` 以 `${gameType}-${roomCode}` 开头。
- 同一终局状态两次 `resolve`，`canonicalJson(serializeReviewDocument(…))` 相同；`nextRound`（只推进局标识）后 `roundKey` 不同。
- 源码规则：复盘组件与导出控制器只在 `src/features/room/review/` 内使用；游戏不直接用截图与分享服务；入口只经两个构建函数（不手写 `review` key、不直接用 `TESTIDS.roomReview*`）。
- 单页高度：jsdom 没有布局，改由 `paginateReviewFlow` 的估高测试（最长接龙每页都在预算内）与运行期上限 fail fast 共同保证。

### 9.2 游戏级（纯数据断言，无 RN 渲染）

- `toXReviewDocument(state)` 断言块序列与关键事实：胜方、身份、词语、排名、出局顺序、续页。
- 狼人杀：原 `NightReviewShareCard.test.tsx` 的事实用例（狼队共同目标、空刀不出现 0 号、未行动淡化行、身份墙恰一人出局）已迁为 `toWerewolfReviewDocument.test.ts` 的数据断言；警长竞选的面板 / 复盘等价性只比数据。

### 9.3 渲染器（一次性）

- 每种块一个渲染测试；`mode='screen'` 与 `mode='export'` 的文本序列只差页眉。
- `image` 加载 / `unavailable` / 失败 / 重试与就绪闸门；标签印在内容上方。

### 9.4 导出控制器

- 作用域键随 roomId / userId / 页宽 / 分享标题 / 文档变化；并发合并；取消不中断截图；预截图；`ShareImageOutcome` 映射；小程序 `uploading` 阶段。

### 9.5 E2E

- 狼人杀（`werewolf-night-flow.spec.ts` 2 人局）：天亮后房主从主持管理打开「本局复盘」→ 防剧透确认「确定查看」→ 对话框内「保存／分享图片」→ 下载 `werewolf-<roomCode>-1.png`。
- 阿瓦隆 / 谁是卧底 / 瞎掰王：终局从底部「本局复盘」打开平台对话框并断言内容；谁是卧底导出单页图。
- 你画我猜接龙 / 故事接龙：画廊「分享本篇」打开复盘定位到该篇并「仅分享本页」导出；小程序分支上传全部页并预览。
- 下载断言共用 `e2e/helpers/image-sharing.ts` 的 `downloadReviewImage`（等预截图就绪 → 下载 → 文件名 → PNG 签名与大小）。

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
| 分页由谁决定                      | 游戏按语义声明单元（一篇画册 / 一篇故事 / 一轮），平台 `paginateReviewUnit` 按估高把超长单元切成编号续页；运行期仍校验单页上限      |
| 狼人杀逐座位授权是否上提          | 否。映射为 `notPermitted`；其他游戏终局身份全公开                                                                                   |
| `shareImagesBase64` 返回值        | `ShareImageOutcome`（`handedOff / downloaded / previewed / cancelled`）；失败抛错                                                   |
| 标题、分享标题、通用页脚归谁      | 平台（`reviewCopy.ts`）。八个游戏写的值完全相同，类型里就不该有这两个字段（§11）                                                    |
| 狼人杀版式                        | 保留 #364 文字时间线，扩平台词汇承载（用户决定 2026-11）；不退回分组卡片                                                            |
| 狼人杀入口                        | 入口 → 防剧透确认 → 复盘对话框，分享在对话框底部；「授权玩家查看」为独立主持动作（用户决定 2026-11）                                |
| 警长竞选段                        | 改为通用 `timeline`，删除 `SheriffElectionReportSection`；面板与复盘的等价性只比数据（用户决定 2026-11）                            |
| 文档构建放 game-engine 还是客户端 | 客户端 `src/games/<game>/review/`。构建器是纯函数但依赖客户端的中文展示名（如 `avalonRoleDisplay`）；无服务端消费者时不进引擎       |

已决问题（2026-10-29，用户拍板）：

1. **经典画猜逐轮画作**：做。服务端新增 `turnHistory`（§5.5、§8.5），复盘为 1 + T 页。
2. **瞎掰王复盘内容**：词 + 释义 + 身份分配 + 点选记录（§5.4）足够。
3. **块词汇首版**：十种够用；阿瓦隆每轮提案用 `groups` 表达（§5.2）。不加 `ballot` 块。

开放问题：

1. **导出时间戳**：未实施。页眉只有 kicker、分享标题与页码；客户端时钟不可信，且只有接龙两款有服务端 `completedAt`。需要时另起设计。
2. **经典画猜与接龙画作过期**：已实施为 Worker 410 → 图片块 `unavailable`「画作已过期」，不阻塞导出。是否延长 R2 生命周期由运维成本决定，不在本设计内。
3. **谁是卧底 / 瞎掰王局号**：状态没有局号字段，kicker 写「本局」、文件名不带局号。要印「第 N 局」需引擎状态升版并迁移，未做。

## 11. 实施记录：与设计稿 v2 的差异

代码与契约测试为准；以下记录每处偏离及理由，供追溯。

1. **可用性**：`notPermitted.message` 改名 `reason`；`available` 增加 `sharing`（能读不一定能分享：狼人杀旁观者）与 `confirmation`（狼人杀打开前防剧透）。
2. **文档字段**：删除 `title`、`shareTitle`——八个游戏写的值完全相同（「本局复盘」「房间 X 战报」），由平台 `reviewCopy.ts` 拥有；`footer` 保留（狼人杀有自己的声明），通用页脚为平台常量 `REVIEW_GENERATED_FOOTER`。页 `label` 与多页互为充要，由 `assertReviewDocument` 校验。
3. **词汇扩展**：`hero.headline` 为 runs（`figure` 大号数字）；`stamps` 带 `tone / title / caption / note`；新增 `divider`；`roster` 加 `columns`、`name: null`（只按身份识别的座位）、`isOut`，`roleTone` 改为 `seatTone`；`timeline` 步骤标题可空；`scoreboard` 的名次与分数文案由游戏给出（经典画猜 `rankDrawGuessScores`）；`paragraph` 加 `caption`（标签印在正文上方，接龙的「第 k 棒 · 作者」不再拆成 `section`）；`image.load` 返回 `loaded | unavailable`，reject 才是可重试失败。
4. **狼人杀**：保留 #364 文字时间线，无统计条；警长竞选改为通用 `timeline`；入口直开对话框，分享在对话框底部；授权是独立主持动作；终局任务 `[本局复盘, 授权玩家查看]`。
5. **导出**：结果类型命名为 `ShareImageOutcome`，失败抛错而非 `'failed'`；对话框打开即后台预截图（iOS Safari Web Share 的瞬时激活要求）；导出页宽 = 对话框页宽；进度弹窗只用于无对话框的运行，避免叠两层弹窗。
6. **文件名与分享标题统一**：狼人杀原 `room-${roomCode}-review.png` /「狼人杀房间 X 战报」→ `werewolf-${roomCode}-${n}.png` /「房间 X 战报」；接龙原按座位命名 → 按页序 `-p<n>`。
7. **分页**：新增平台 `paginateReviewFlow`。接龙 20 人 × 512 字的故事或画册会超出 8192 像素单页上限与 iOS 画布面积，游戏声明「必须同页」的组，平台估高续页。
8. **媒体过期**：你画我猜接龙过期画作由 500 改为 410 `PICTIONARY_MEDIA_EXPIRED`，与经典画猜同为 `unavailable`「画作已过期」；经典画猜观战者 403 →「入座的玩家才能查看画作」。
9. **谁是卧底 / 瞎掰王**：无局号（§10 开放问题 3）；谁是卧底中止局按中止时的承诺不公开词语与未揭示身份。
10. **契约测试**：局面由各游戏 `src/test-utils/<gameId>State.ts` 的 `<GAME>_REVIEW_ROUNDS` 提供（谁是卧底、瞎掰王、狼人杀、示例的局面构造从各自测试抽出）；生成器登记新游戏；「jsdom 布局下单页高度」改由分页估高测试 + 运行期上限保证。

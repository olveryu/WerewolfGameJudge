# 全系统架构评估

评估日期：2026-09-17。范围：客户端 UI、全部游戏、产品功能、Worker、数据与交付体系。

历史评估源码基准：`289c7b88`。F01–F10 实施记录更新至：`9b278045`；后续职责拆分见下方第三阶段记录。状态：**F01–F10 已逐项提交并推送，运行验收有保留项**。F08 按用户决定保留业务 E2E 与部署并行。本报告不是全部功能、设备、安全或性能验收通过的声明。

## 实施记录

用户在评估后授权修复已确认问题，并要求每项独立 commit 和 push。下表记录实际交付；后续“结论”至“官方资料与证据边界”保留初始评估，用于说明当时问题和结构建议，不应把其中的旧实现描述当作当前源码事实。结构建议与待验证项不等于已证实缺陷，也未以无依据的重写宣称完成。

| 项目         | 提交       | 已实施的行为与证据                                                                                                                                                                                                                    |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 账户事件 | `269b4867` | 收件箱由 App 账户生命周期通过 HTTP 读取和 ACK；房间只处理游戏快照/同步协议。换账号取消请求，后台暂停，前台立即消费，空队列每 30 秒检查。真实 DO/HTTP 所有权测试与客户端取消、ACK 重试测试通过；删除旧房间事件 codec、泛型和专用指标。 |
| F02 命令身份 | `559bf6cc` | 写入及读取回执都使用 canonical JSON 比较语义身份，保留有效旧回执。真实 DO 测试验证字段重排重放成功、revision 不增加、不同内容仍冲突。                                                                                                 |
| F03 抽卡状态 | `db4420f2` | 区分匿名、首次加载、读取失败、真实零余额、缓存刷新失败。组件测试与本地 Chromium 503 故障注入通过；失败不再显示假零余额。                                                                                                              |
| F04 头像替换 | `6807cd6f` | 先上传新不可变对象，D1 条件切换引用，成功后回收旧对象；冲突删除本次未采用对象。真实 D1 失败、旧 URL 可读及并发替换测试通过。                                                                                                          |
| F05 反馈投递 | `9b278045` | 新增 D1 投递意图、稳定操作 ID 和 GitHub 正文标识；调用外部前持久化 uncertain，结果不确定只核对、不再创建。历史与 UI 展示待同步记录及核对入口。真实 D1 注入失败、并发恢复、丢失评论响应、回复重开、HTTP 所有权及组件重试测试通过。     |
| F06 语义尺寸 | `fbf7ede2` | 全局字号/间距不再取决于首次视口宽度，保留像素对齐。320/390/1440 单测一致；首页 1440→390→刷新标题均为 20px，无页面横向溢出。                                                                                                           |
| F07 交互语义 | `4bd72569` | 外观分类具备 tab/tabpanel、选中态和方向键/Home/End 焦点行为；稀有度筛选具备按钮/按下态；字段错误关联输入。组件与浏览器键盘、弹窗焦点恢复检查通过；未修改已有 AppModal 实现。                                                          |
| F08 发布产物 | `6a0ffad3` | 用户明确不等待业务 E2E。新增发布前 CDN JS/资源字节 SHA-256 校验及 gzip WASM 解压校验，脚本 120 秒预算、CI 步骤 3 分钟限制；不匹配则不发布前端。模拟错误/缺失资源与真实本地 HTTP 字节测试、CI 依赖契约通过。                           |
| F09 设置保存 | `c89e9aea` | 存储成功后才更新内存和订阅者，失败显式向调用方传播；音乐预览和警长设置处理失败并恢复已保存状态。24 项聚焦测试通过。                                                                                                                   |
| F10 后台请求 | `c6aa4046` | 用户列表由筛选条件组成 Query key，请求接入取消与超时，加载/失败不显示旧总数和分页。真实 QueryClient 测试验证 A 被取消、B 先到、A 迟到不能覆盖。                                                                                       |

每项均在独立提交前完成 `pnpm run quality`，commit/push hooks 未跳过。最终 F05 门禁结果：

- TypeScript（根项目、Pages、Worker 生产/测试）、生成类型、引擎构建、Knip、agent drift、ESLint、Prettier 全部通过。
- 引擎：91 个测试文件、2,654 项通过；客户端：271 个文件、10,616 项通过；Worker：45 个文件、296 项通过。
- 测试数量包括大量静态架构断言，不能当作同等数量的端到端用户流程。旧事件协议专用测试随路径删除，不以数量减少推断覆盖退化或提升。
- `push` 已成功，但服务端报告当前账号绕过 protected-main 规则，CodeQL 仍待结果；没有使用 `--no-verify` 或强制推送。成功 push 不代表远端 CI/生产部署完成。

### 保留项与恢复边界

- **F08 是用户接受的风险，不是业务 E2E 门禁修复。** E2E 仍可能在部署后失败；字节一致不证明游戏业务正确。本次未测完整生产 CDN 产物在限时内完成的耗时，也未声称已经完成部署后 smoke。
- **F05 无跨系统原子提交保证。** 新迁移 `0053_feedback_deliveries.sql` 仅新增表，不重建或删除已有反馈/回复。`pending` 可执行首次投递；`uncertain`/`needs_review` 只查 GitHub；`synced` 表示本地会话记录与投递状态已在同一 D1 batch 提交。
- F05 核对使用正文首行 `<!-- feedback:<id> -->`，最多 20 页、每页 100 条、一次核对 10 秒。空结果不是“确定未创建”；多匹配、读失败或达到上限均不能触发第二次创建。用户可从反馈详情再次核对；无法确认时保留人工处理状态，不无限 spinner，也不假报成功。
- F05 人工核对由维护者按投递 ID 读取 D1 的 `kind`、`feedback_id`、`github_body`、`status`，检查 GitHub 对应标识及评论所属 Issue。确认原对象存在且标识完整后，使用页面核对入口完成本地提交。标识被删、对象被转移/删除、核对超过分页范围或仍存在在途请求时，应先调查并明确处置，不直接改为 `pending` 或再次 POST。当前没有自动重发或管理员强制认领接口。
- F05 已验证真实 D1 与替身 GitHub provider 的故障窗口；未向真实 GitHub 创建测试 Issue/评论。组件交互测试通过，但浏览器截图验收因公告/登录自动化流程连续失败停止，移动/桌面反馈面板视觉验收未完成，不记为通过。
- F01 同一挂载周期保留通知去重状态，ACK 重试不重复 toast；整个页面重载可能重新显示未 ACK 通知，但不会重新结算奖励。查询失效 Promise 失败时不 ACK；未额外保证 Query 默认吞下的后台 refetch 错误也阻止 ACK。未完成真实浏览器跨三游戏结算组合场景。
- F04 异步清理失败会显式记录，后续成功头像上传会再次清理；没有后续上传时，不保证无人引用对象自动回收。R2 生产生命周期配置未验收。
- 全部游戏真机/UI 流程、读屏、200% 缩放、画布帧耗时、完整业务 E2E、生产容量/恢复、安全评审与 AI 真实生成质量仍未验收。远端另报 92 项依赖漏洞，尚未调查，不归因于本次改动。

### 第三阶段：RoomSession 职责拆分

2026-09-17，按用户授权实施命令恢复所有权拆分：

- [RoomSession](../src/features/room/session/RoomSession.ts)保留统一入口、身份、epoch、请求取消及权威快照的校验与发布；[ConnectionManager](../src/services/connection/ConnectionManager.ts)保持原有连接职责，不重写。
- 新增 [RoomCommandRecovery](../src/features/room/session/RoomCommandRecovery.ts)，独立拥有意图去重、在途请求合并、持久化恢复、串行重放、连接代际与重试计时器。协调器仅提供发送能力、连接可恢复状态，并接收待确认数量和拒绝结果。
- 每次进入房间创建新恢复实例，退出时停用旧实例、清空内存队列并取消重试计时器；持久化待确认记录不删除。旧异步任务的完成逻辑不能重新调度新会话的队列，用户切换按原 roomId/userId 隔离恢复。
- 保持公共 RoomSession 接口、网络协议、命令 ID 和存储格式不变。准备好的命令仍需通过 epoch/房间身份校验；服务端提交快照仍先应用再返回调用方。没有新增游戏状态副本。
- 暂不另抽快照 store：当前快照校验和订阅发布仍属于协调器的单一权威投影，没有独立的资源生命周期；仅为缩短文件而拆分会增加同步关系。
- [RoomSession 测试](../src/features/room/session/__tests__/RoomSession.test.ts)共 16 项通过，覆盖退出取消、原 ID 重放、持久化先于发送、未知结果重试及新加的跨用户交错场景：旧响应晚到时，新恢复队列仍逐条执行，旧用户记录保留，新用户快照不被覆盖。
- 完整 `pnpm run quality` 通过：引擎 2,654、客户端 10,626、Worker 296 项测试；类型、构建、Knip、agent drift、lint、格式检查全部通过。客户端计数包含随新文件生成的架构断言。本次未运行浏览器 E2E，不把本地通过等同远端 CI 或生产验收完成。

### 第三阶段 3A：狼人杀页面生命周期

- [复盘分享 hook](../src/games/werewolf/room/hooks/useNightReviewShare.ts)独立拥有报告数据、截图任务、缓存和平台分享。缓存绑定房间、用户、对局和报告内容；重复捕获合并，旧任务结束不能覆盖新报告或打开分享界面，捕获失败显式报告并允许重试。
- 房间组合 hook 保留已有身份、行动草稿及动作编排器，只组装这些能力。选牌与二次选座按真实行动作用域复位，不随无关快照关闭。
- 复盘弹窗的异步更新与确认回调绑定请求生命周期。共享 alert 沿用已有 generation，新增定向关闭，退出只能关闭自己持有的提示，不能关闭后来的其他提示。
- 相邻测试验证账户切换时旧截图失效、失败重试、旧复盘回调失效及提示所有权。当前使用替身截图/分享适配器，尚不能据此声称原生或微信分享设备验收通过。
- 验证：`pnpm run quality` 全通过，engine 2,654 + client 10,640 + Worker 296，共 13,590 项测试；共享弹窗与复盘聚焦测试 38 项通过。

### 第三阶段 3B：账号外观编辑会话

- 外观入口按账号及匿名身份重建编辑会话；藏品查询与编辑器分离。首次加载失败显示重试，不再将未知持有状态展示为全部未解锁；后台刷新失败保留已知藏品和当前草稿。
- 编辑器继续组合原有网格构建器、预览和保存 hook，不新增共享状态仓库。未保存更改有显式标记；上传、保存和装备共用会话内互斥，退出会话后不再继续刷新、同步房间或导航。
- 账号写入成功但资料刷新或房间同步失败仍报告部分成功，不重复账号写入。保存失败留在编辑器，可重试。
- 验证：`pnpm run quality` 全通过，engine 2,654 + client 10,643 + Worker 296，共 13,593 项；新增 3 项受控异步测试覆盖退出、重试和部分成功。
- 浏览器确认本地外观页与真实开发账号藏品可加载；集成浏览器处于隐藏状态且截图视口不一致，桌面/手机交互与视觉验收尚未通过，不能用这些截图声明验收完成。

### 第三阶段 3C：抽奖交易与展示分离

- `useDrawPresentation` 仅管理 requesting / animating / results / dismissed 展示阶段，不提交交易、不修改余额或账本。页面沿用现有 `useDrawMutation` 和持久化操作恢复。
- 服务端结果确认后立即可主动查看，不依赖 `PHASE.DONE`；关闭后可再次查看。失焦、退后台及减少动态效果直接进入结果展示；请求期间退后台的晚响应也按当前环境处理。
- 抽奖页按账号隔离展示会话。结果层只消费确认结果，机器动画不再拥有交易成功的解释权。
- 验证：聚焦 6 项测试通过；`pnpm run quality` 全通过，engine 2,654 + client 10,654 + Worker 296，共 13,604 项。未将 hook 测试等同于设备动画验收。

3D 启动首页及性能专项仍待实施。以下为历史评估正文，当前实现以顶部实施记录及第三阶段记录为准。

## 结论

**不建议全仓推倒重写。建议对明确失配的子系统整体重构，同时保留现有平台与领域边界。** 当前问题不是单纯“代码不够整齐”，而是部分业务的生命周期、失败终态、UI 状态和发布保障没有形成一致契约。

- **值得整体重构**：账户事件消费、反馈的外部同步流程、头像替换流程、响应式与可访问性交互基础层、后台页面的数据请求模型。
- **需要按职责拆分**：RoomSession、启动编排、狼人杀房间控制器、抽卡结果呈现、外观编辑控制器。拆分依据是不同生命周期与状态所有权，不是文件超过某个行数。
- **应保留**：纯游戏决策/演进、三层游戏注册、DO 权威状态与事务回执、outbox、D1 房间目录 saga、抽卡与结算账本、平台音频策略、画作不可变上传和本地草稿、AI 词库分阶段发布。
- **UI 需要系统性改造**：不仅改颜色与圆角。必须把布局、状态反馈、键盘/读屏语义、导航与动画完成条件一起纳入；不预先迁移框架。

## 系统覆盖表

“保留”表示该设计有明确价值，不代表全部实现无缺陷。表内入口及下文发现共同构成证据索引。

| 系统               | 核心证据                                                                                                                                                                                                                                        | 判断与下一步                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 启动与依赖组装     | [App](../App.tsx)、[createAppServices](../src/app/createAppServices.ts)、[useBootProgress](../src/app/useBootProgress.ts)                                                                                                                       | 保留集中组装；拆开遥测、Web splash DOM 与应用 ready 状态。头像预取目前也阻塞 ready，需用生产数据判断是否移出关键路径。                           |
| 导航与游戏扩展     | [导航](../src/navigation/AppNavigator.tsx)、[客户端 catalog](../src/games/catalog.ts)、[Worker catalog](../packages/api-worker/src/games/catalog.ts)                                                                                            | 保留显式穷举注册与 URL 参数校验；不要把静态导入直接等同于全量首屏下载，分包收益须检查构建产物。                                                  |
| 认证与账号切换     | [CFAuthService](../src/services/cloudflare/CFAuthService.ts)、[AuthContext](../src/contexts/AuthContext.tsx)、[tokenAuth](../packages/api-worker/src/features/auth/tokenAuth.ts)                                                                | 保留服务身份快照、Query 资料分离与 tokenVersion 撤销检查。后续统一会话、缓存、账户事件的退出顺序；不凭本次审查声称安全认证。                     |
| 房间创建/进入/退出 | [创建服务](../src/features/room/services/RoomCreationService.ts)、[LazyRoomSession](../src/features/room/session/LazyRoomSession.ts)、[房间 saga](../packages/api-worker/src/platform/room/roomSaga.ts)                                         | 保留不可变 roomId、独占 lease、延迟资源分配与中断恢复。不要把房间编号当永久身份。                                                                |
| 命令与客户端恢复   | [RoomSession](../src/features/room/session/RoomSession.ts)、[恢复存储](../src/features/room/services/RoomCommandRecoveryStore.ts)、[回执](../packages/api-worker/src/platform/room/roomRepository.ts)                                           | F02 优先；再按连接/命令/快照/账户事件拆职责，保留单一入口和 epoch。                                                                              |
| 实时与副作用       | [实时服务](../src/services/cloudflare/CFRealtimeService.ts)、[连接管理](../src/services/connection/ConnectionManager.ts)、[outbox](../packages/api-worker/src/platform/room/effectOutbox.ts)                                                    | 保留连接状态机、相关快照恢复与持久化重试。账户通知移出游戏 codec，见 F01。                                                                       |
| 狼人杀规则与 UI    | [引擎](../packages/game-engine/src/games/werewolf/engine.ts)、[房间控制器](../src/games/werewolf/room/hooks/useWerewolfRoomScreenState.ts)                                                                                                      | 保留角色模型与 handler/reducer 边界；控制器同时处理身份、动作草稿、弹窗、倒计时和复盘截图，应按这些职责拆分。不得扩大为跨夜规则。                |
| 瞎掰王规则与 UI    | [引擎](../packages/game-engine/src/games/fibking/engine.ts)、[演进](../packages/game-engine/src/games/fibking/domain/evolve.ts)、[房间控制器](../src/games/fibking/room/hooks/useFibRoomScreenState.ts)                                         | 保留 preparing/preparationFailed 等显式状态和共享房间控制器；不为消除表面相似代码而制造统一三游戏巨型状态机。                                    |
| 你画我猜规则与 UI  | [引擎](../packages/game-engine/src/games/pictionary/engine.ts)、[草稿提交](../src/games/pictionary/room/hooks/usePictionaryDraftFinalizer.ts)、[画布](../src/games/pictionary/room/components/PictionaryDrawingCanvas.tsx)                      | 保留权威收稿阶段、本地任务作用域草稿和失败重试。高频手势在 JS 上执行且构建路径，需专项设备帧耗时验证，不能据此直接宣称卡顿。                     |
| 成长与结算         | [结算](../packages/api-worker/src/games/werewolf/settlement/settleGameResults.ts)、[结算 effect](../packages/api-worker/src/games/werewolf/effects.ts)                                                                                          | 保留 effectId 结果账本与确定性奖励重放。当前结算是狼人杀业务，不自动把同样资格规则推广到另外两款游戏。                                           |
| 抽卡与兑换         | [mutationLedger](../packages/api-worker/src/features/gacha/mutationLedger.ts)、[操作存储](../src/features/gacha/services/GachaOperationStore.ts)、[执行器](../src/features/gacha/services/runGachaOperation.ts)                                 | 保留原操作恢复与原子扣款；F03 修页面，不重写账本。房间和抽卡恢复语义不同，不合并成万能重试服务。                                                 |
| 外观与收藏         | [外观状态](../src/screens/AppearanceScreen/hooks/useAppearanceState.ts)、[保存](../src/screens/AppearanceScreen/hooks/useAppearanceSave.ts)、[外观页面](../src/screens/AppearanceScreen/AppearanceScreen.tsx)                                   | 将选择草稿、商品目录、账户保存与房间资料同步分别建模；保留“账户已保存、房间同步失败”的部分成功反馈。收藏/解锁的读取失败不能等同未拥有。          |
| 头像与用户媒体     | [头像路由](../packages/api-worker/src/features/account/avatarRoutes.ts)、[画作路由](../packages/api-worker/src/games/pictionary/mediaRoutes.ts)                                                                                                 | 头像替换流程重构，见 F04；画作已有预约、摘要、条件写入和确定性提交 ID，应保留并验证故障窗口。                                                    |
| AI 词库与聊天      | [供应 workflow](../packages/api-worker/src/games/fibking/wordSupplyWorkflow.ts)、[发布](../packages/api-worker/src/games/fibking/wordPublication.ts)、[聊天路由](../packages/api-worker/src/games/werewolf/aiChat/routes.ts)                    | 保留词库预算、证据、审核和发布分离。聊天属于实时请求，不强行复用离线工作流；流式返回头成功不等于生成完成，运营指标须明确含义。未调用真实供应商。 |
| 音频与音乐设置     | [AudioService](../src/services/infra/AudioService.ts)、[设置服务](../src/features/settings/services/SettingsService.ts)                                                                                                                         | 保留 Web/native 策略和 BGM 分离；明确播放资源所有权、可见性与偏好保存结果，见 F09。未验收真机音频解锁。                                          |
| 首页、公告与安装   | [首页](../src/screens/HomeScreen/HomeScreen.tsx)、[安装入口](../src/features/home/controllers/usePWAInstall.ts)                                                                                                                                 | 首页集中了日奖励、公告、反馈未读、最近房间和登录后续操作；账户级副作用应离开首页生命周期，视图保留入口编排。                                     |
| 反馈与分享         | [反馈](../packages/api-worker/src/features/feedback/routes.ts)、[分享图片](../packages/api-worker/src/features/sharing/routes.ts)                                                                                                               | 反馈同步重构，见 F05。临时分享保持独立于账号头像、游戏私有画作的访问/保留策略；R2 生命周期真实配置未查。                                         |
| 后台与权限         | [后台路由](../packages/api-worker/src/features/admin/routes.ts)、[后台页面](../src/screens/AdminScreen/AdminScreen.tsx)、[用户列表](../src/screens/AdminScreen/tabs/UsersTab.tsx)                                                               | 请求状态统一，见 F10；共享口令与个人管理员身份不是同一概念，应单列权限与操作归属方案。                                                           |
| 数据与维护         | [定时任务](../packages/api-worker/src/app/scheduled.ts)、[房间仓库](../packages/api-worker/src/platform/room/roomRepository.ts)、[账本](../packages/api-worker/src/features/gacha/mutationLedger.ts)                                            | 保留 DO/D1/R2 分工、所有者维护任务和失败汇总；为跨存储写入统一要求提交点与回收规则，不要求统一实现。生产容量、索引与恢复演练未验证。             |
| 错误、监控与隐私   | [错误管线](../src/utils/errorPipeline.ts)、[Query 配置](../src/app/queryClient.ts)、[Worker](../packages/api-worker/src/index.ts)、[隐私说明](../PRIVACY.md)                                                                                    | 错误分类与上报所有权需收敛；Query 全局回调与局部 catch 使用不同分类方式。隐私说明已披露 Sentry PII、回放与公开反馈，不能声称完全未披露。         |
| Web/PWA/小程序     | [HTML](../web/index.html)、[小程序壳](../miniapp/pages/index/index.js)、[构建](../scripts/build.sh)                                                                                                                                             | 保留 web-view 壳策略；当前 HTML 主动注销 SW/清缓存，不把可安装性宣传成离线游戏能力。小程序登录和网络恢复需设备验收。                             |
| 测试与交付         | [CI](../.github/workflows/ci.yml)、[架构契约](../src/__tests__/architecture.contract.test.ts)、[E2E 配置](../playwright.config.ts)                                                                                                              | F08 优先；保留边界测试，补真实跨层故障场景。CDN URL 改写分布在脚本与 CI，应建立单一产物清单与构建后验证。                                        |
| UI 公共层          | [tokens](../src/theme/tokens.ts)、[Button](../src/components/Button.tsx)、[FormTextField](../src/components/FormTextField.tsx)、[AppModal](../src/components/AppModal/AppModal.tsx)、[RoomShell](../src/features/room/components/RoomShell.tsx) | 系统性重构尺寸、状态与交互契约，见 F06/F07。保留游戏房间 shell 的显式插槽与能力模型，不另建平行组件库。                                          |

## 评估约定

- 初始评估阶段只编写文档；后续业务修改、提交及验收以顶部实施记录为准。
- 评估以当前源码为准，历史设计文档不作为实现事实。
- **已复现**：通过隔离探针或本地页面观察到具体行为；不代表生产发生率已知。
- **静态确认**：实现路径完整可见，但未执行对应端到端场景。
- **结构建议**：基于职责、依赖和维护成本提出的调整，不等于已发生故障。
- **待验证**：运行、设备、性能或供应商证据不足；不得写成通过。

## 已确认的优先问题

### F01：账户事件由游戏房间消费

等级：高；证据：本会话前段的源码隔离探针已复现。

[用户收件箱](../packages/api-worker/src/platform/userEvents/inbox.ts)按用户读取最早事件；历史基准中的[房间运行时](../packages/api-worker/src/platform/room/GameRoomRuntime.ts)在连接时投递。非狼人杀游戏使用拒绝用户事件的 `noRoomUserEventCodec`（该文件已在 F01 删除），[实时服务](../src/services/cloudflare/CFRealtimeService.ts)解析失败后关闭连接，关闭码为 1002。

因此，未 ACK 的狼人杀结算事件可以阻断同一用户在其他游戏中的连接。探针使用真实实时服务与 codec、模拟 WebSocket；未运行跨游戏浏览器或生产 D1 场景。

建议整体重构用户事件的所有权：账户生命周期负责接收、消费状态与 ACK，游戏只产生业务结果；不通过忽略未知事件或增加旧协议兼容掩盖问题。是否需要独立连接应另行论证，不预先引入。

### F02：命令回执把 JSON 键顺序当作业务身份

等级：高；证据：本会话前段的跨源码隔离探针已复现。

[恢复存储](../src/features/room/services/RoomCommandRecoveryStore.ts)使用 canonical JSON 持久化，[房间仓库](../packages/api-worker/src/platform/room/roomRepository.ts)却以 JSON.stringify 的原始字符串比较命令身份。狼人杀提交动作首次字段顺序为 type/input/expectedStep，恢复后为 type/expectedStep/input；经过实际请求 schema 后仍不同。

探针确认：命令深度相等，但真实 readReceipt 返回 conflict。应统一请求身份的语义序列化，并保留尚在有效期内的业务回执；这不是旧客户端兼容需求。

### F03：抽卡读取失败与零余额混为一谈

等级：中；证据：静态确认及本地浏览器已复现。

[抽卡页面](../src/screens/GachaScreen/GachaScreen.tsx)只读取 status/isLoading，缺少错误渲染分支，并把缺失的票数、碎片与保底数据设为 0。[查询封装](../src/features/gacha/queries/useGachaQuery.ts)返回完整查询结果，但页面未消费错误状态。首次查询失败、无缓存时，会渲染近似于零余额的正常页面。

应明确区分未登录、加载、失败、真实空数据、成功和后台刷新失败；保留缓存时也不能把旧值表现为刚确认的余额。修复落在页面查询状态契约，不修改抽卡账本。

本地复现：新页面拦截 `GET **/api/gacha/status` 返回 503，打开 `/gacha`，等待现有重试结束。页面显示“普通 0、黄金 0、0 碎片、券不足”，没有查询失败说明或重试入口。之后已移除拦截；未执行抽奖或兑换。

### F04：头像替换在提交前删除有效旧资源

等级：高；证据：静态确认；没有实际删除用户资源做复现。

[头像上传](../packages/api-worker/src/features/account/avatarRoutes.ts)执行顺序是列出并删除旧对象、上传新对象、更新 D1 资料。新上传或 D1 更新失败时，旧 URL 可以继续留在资料中但其对象已经删除。并发上传还需要明确谁是最终生效版本。

建议将整个替换流程改成：写新不可变对象、条件更新资料引用、提交成功后异步回收不再引用的旧对象。失败时保留原可用头像；无法确认更新结果时先核对引用，不能直接删新旧对象。[现有头像测试](../packages/api-worker/src/features/account/__tests__/avatarRoutes.test.ts)只验证对象键后缀，未覆盖此窗口。

### F05：反馈跨 GitHub 与 D1 写入没有恢复状态

等级：中；证据：静态确认。

[反馈创建与追问](../packages/api-worker/src/features/feedback/routes.ts)先调用 GitHub，再写 D1。外部成功、D1 失败或响应丢失后，重试没有持久化业务操作 ID 来关联原 Issue/评论，可以留下外部孤立记录或重复创建。

建议重构为 D1 中的反馈意图与同步状态，加所属模块的持久化投递/核对流程。GitHub 创建接口不能假定天然幂等；调用结果不确定时，要有可检索关联标识、核对或人工终态，不能简单无限重试。用户应能区分“已接收、同步中、同步失败”。这不要求把账户反馈寄存在某个游戏 DO 中。

### F06：响应式尺寸由首次加载宽度决定

等级：中；证据：源码和浏览器已复现。

[tokens](../src/theme/tokens.ts)在模块加载时读取 `Dimensions.get('window')`，把 SCALE 固定下来；[首页](../src/screens/HomeScreen/HomeScreen.tsx)同时使用实时窗口宽度创建布局。

实测：在 1440×900 页面切到 390×844，标题字号为 25px；保持 390×844 刷新后为 21px。相同视口因加载历史不同而产生不同 UI。手机截图中标题与右侧入口明显拥挤；没有测得页面级横向溢出。

重构方向：字体采用稳定语义字号，响应用户字号设置；布局、列数、留白由实时窗口或容器约束计算。不能仅让全局字号随窗口重算，继续把桌面设计等同手机等比放大。验收必须同时覆盖冷启动、窗口缩放与横竖屏切换。

### F07：交互语义只在部分共享组件成立

等级：中；证据：源码和浏览器可访问性树已确认；未进行完整读屏验收。

[外观分类](../src/screens/AppearanceScreen/components/PickerTabBar.tsx)仅用 TouchableOpacity 与视觉选中线，没有 tab/selected 语义；本地树中显示为 generic。抽卡票种切换却呈现为 tab。同页稀有度筛选也为 generic。[FormTextField](../src/components/FormTextField.tsx)能绘制错误文本，但没有替调用者建立输入与错误的关联契约。

应基于现有组件建立 tab/分段选择、过滤选项、图标按钮、字段错误和弹窗焦点的统一交互契约。不要仅修改颜色或加 testID；键盘可达、角色、名称、选中/不可用状态和焦点恢复都要可验证。已有 AppModal 的背景 inert 机制应保留；多弹窗、焦点回归仍待运行验收。

### F08：生产发布不等待 E2E

**实施决定覆盖以下原建议：用户明确不等待业务 E2E；已增加限时 CDN 字节门禁，业务风险保留，见顶部实施记录。**

等级：高；证据：静态确认 CI job 依赖。

[CI](../.github/workflows/ci.yml)中 Worker 部署依赖 quality，前端依赖 quality 与 Worker，E2E 也只依赖 quality。它们并行，E2E 失败不是部署阻断条件。不能用仓库可能存在的分支保护推断本次发布天然受阻，远端保护规则未查询。

建议发布图明确为：静态质量与契约测试、必须的本地集成/E2E、构建产物校验、部署、部署后只读 smoke。耗时用选择测试/分片解决，不以忽略关键失败解决。API 先于前端更新，还需定义当前版本发布窗口和回退策略；不为此永久维护旧客户端协议。

### F09：设置保存失败后没有明确结果

等级：中；证据：静态确认。

[SettingsService](../src/features/settings/services/SettingsService.ts)先改内存，再保存；保存抛错时仅调用 `handleError(... feedback: false)`，不重新抛出，也不通知监听者。调用方 `await` 正常完成，但持久化失败，内存与订阅 UI 还可能不一致。

应明确选择“保存成功才提交内存”或“立即生效但明确未持久化”的产品语义，返回可处理的结果；不能在接口上伪装成已保存。读取缺失偏好使用默认值与保存失败是两件不同的事，不应一概禁止默认值。

### F10：后台筛选请求可以被旧响应覆盖

等级：中；证据：静态确认调用与消费链；未用管理员凭据做故障注入。

[UsersTab](../src/screens/AdminScreen/tabs/UsersTab.tsx)每次筛选变化运行 loadData，完成后直接 setUsers/setTotal；没有请求取消或当前请求身份判定。[adminFetch](../src/features/admin/services/adminApi.ts)只有超时信号，不提供筛选生命周期的取消能力。A 请求较慢、B 请求先返回时，A 可以覆盖 B 的结果。

应把后台读取迁移到现有 Query 体系，以筛选条件组成 query key，并接入取消信号，统一加载、错误与分页状态。不要新建另一套缓存框架。

另外，[管理员口令存储](../src/features/admin/services/adminCredentialStore.ts)直接持久化共享 token；服务端身份是口令校验，不是具体管理员。若需要多人管理、单人撤销与操作归属，应整体设计管理员会话与审计主体。本次没有证明口令泄露或可绕过鉴权，不把架构治理不足写成已发生入侵。

## UI 改造方案

### 页面与信息架构

首页应让“选游戏/创建、输入房间号、恢复最近房间”形成清晰任务区。当前桌面截图是多个宽大卡片纵向铺满，内容密度和扫描效率低；手机上则受长标题与头部动作空间限制。推荐桌面使用受约束的内容宽度与任务分栏，手机保留单列主流程，不把每个页面区段都做成浮动卡片。具体品牌与色彩选择需另行设计确认。

房间保留 [RoomShell](../src/features/room/components/RoomShell.tsx) 的共享头部、座位、管理面板与工作区插槽。狼人杀动作、瞎掰王身份、你画我猜画布属于不同任务，应拥有各自的主工作区；不能为了视觉统一把不同游戏都塞成同一种卡片表格。

抽卡、外观、收藏、兑换需要清晰的入口和返回关系。抽卡交易确认与动画完成是两个状态：服务端成功不能依赖动画回调才被用户得知，离开/减少动态效果/渲染失败也必须能到达结果页。现有 reduced-motion 分支值得保留，是否存在动画卡死尚未验证。

后台应以筛选、列表/表格、分页和操作结果为中心。移动端可转换成简洁行式详情，不应为每条业务记录堆叠装饰性卡片。账号与设置页应把身份操作、偏好、资产入口和关于信息分组，避免一个控制器同时承担资料保存、登录状态追踪、房间同步和视图绘制。

### 状态、主题与组件契约

| 层次       | 目标                                                       | 验收重点                                                                       |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 主题       | 稳定的颜色/字号/间距/层级语义；游戏阵营、商品稀有度可扩展  | 实际只有一套静态颜色，不以文档中的计划主题当已实现；不为了抽象先造主题切换系统 |
| 响应式     | 容器宽度、断点、列数和可用高度独立于字号                   | 同尺寸冷启动与 resize 后一致；长中文标题、浏览器缩放和安全区不冲突             |
| 查询状态   | 登录要求、初次加载、错误、空结果、成功、旧数据刷新失败分开 | 故障不表现为 0 余额、无收藏或无记录；错误有明确动作                            |
| 操作状态   | 提交中、已确认、结果不确定、业务拒绝、部分成功分开         | 每种状态有可执行恢复或结束方式；不得无限 spinner                               |
| 交互控件   | 已有 Button/PressableScale 上统一按钮、tab、筛选、输入     | 名称/角色/选中态、键盘、焦点、禁用说明；不能一律依赖屏幕上的图标字体字符       |
| 弹窗与通知 | 背景阻断、顶层焦点、关闭后返回原入口；账户通知独立于房间   | 多层弹窗不穿透；通知去重与业务 ACK 不依赖某页 focused                          |
| 动画与画布 | 装饰动画、业务反馈和交互绘制分级管理                       | 页面失焦/后台停止装饰动画；减少动态效果可完成业务；真机长绘制性能需另测        |

公共层只定义可复用语义，不定义游戏规则；页面控制器组装数据和意图，呈现组件不直接做资料写入、交易恢复或导航决策。不要把所有 hook 合并成一个全局 store，也不要把每一段 JSX 都拆成没有独立职责的文件。

### 本次实际页面检查

- 首页：1440×900 与 390×844 截图、可访问性树、宽度检查；这两个视口的 document scrollWidth 未超出视口。
- 响应式：同一 390px 视口 resize 后/刷新后的标题字号分别为 25px/21px。
- 抽卡：390×844，状态 GET 注入 503 并观察重试后零余额/券不足误导状态；已撤销注入。
- 外观：390×844，读取实际页面和可访问性树，确认分类语义缺失；未上传、选择或保存。
- 没有进入或操作现有游戏房间，没有抽奖、兑换、发反馈或执行管理写操作。打开首页会运行现有自动日奖励等页面副作用，本次未额外触发或核对它们。
- 三款游戏完整局内视觉流程、200% 缩放、键盘全流程、读屏、原生/微信设备、慢网与真实画布帧耗时仍需专项验收；不能由以上样本推断全部通过。

## 目标职责与重构边界

建议保留以下主方向：

1. **平台**：房间身份、命令收据、快照版本、连接和存储事务；不消费游戏专有 UI 通知。
2. **游戏领域**：决定命令是否合法、产生状态变化和业务 effect；不调用 React、D1、R2 或导航。
3. **游戏适配层**：把纯决策连接到 Worker 副作用，以及客户端游戏工作区；不接管账户生命周期。
4. **账户/产品**：资料、资产、通知、外观与反馈；服务端持久化是权威，客户端 Query 只是投影。
5. **UI**：根据确认的数据与显式状态呈现，输出意图；动画不得决定业务成功与否。
6. **交付与运营**：证明产物可用、部署受门禁控制、持久化副作用有人工恢复路径。

RoomSession 拆分以真实职责为界：保留协调器，内部可分命令恢复与快照存储；先移出账户事件，再判断还需要多少拆分。ConnectionManager 已有明确职责，不因 RoomSession 拆分而重写一遍。前台可见性、请求 epoch、业务操作 ID 是不同概念，不合并为一个万能版本号。

头像、反馈与房间创建虽然都跨存储/外部系统，但提交点和恢复语义不同。统一的是“谁拥有意图、何时成功、如何核对、如何回收”的要求，不是统一一个庞大的通用 saga 框架。

## 实施顺序与验收

| 顺序 | 工作包                      | 前置与迁移风险                                               | 必须通过的行为验收                                                            |
| ---- | --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1    | F01/F02 账户事件与命令身份  | 保留待消费事件和有效回执；明确切换时机，不能丢弃历史业务数据 | 狼人杀结算未 ACK 后进另外两游戏；刷新恢复同 ID/同内容命令；真正不同内容仍冲突 |
| 1    | F04 头像替换                | 新旧对象引用切换、并发提交、孤立对象回收                     | 上传失败保留旧头像；D1 失败不破坏旧引用；同用户并发替换最终只有有效引用被保留 |
| 1    | F08 发布门禁                | 用户决定业务 E2E 保持并行；不增加生产数据写测试              | 已改为 CDN 字节不一致时阻止前端发布；业务 E2E 失败仍不阻断部署                |
| 2    | F03/F06/F07 UI 状态与基础层 | 从抽卡/外观/首页示范迁移，保留已有业务能力                   | 503 不显示假余额；resize/刷新一致；tab/字段错误/弹窗具备交互语义              |
| 2    | F05 反馈同步、F09 设置结果  | 反馈需持久化意图和外部关联；设置需先选持久化失败语义         | GitHub 成功/D1 失败能核对；设置配额错误不能向调用者假报保存成功               |
| 2    | F10 后台读取与管理员边界    | 查询重构不要求同时替换身份；身份迁移需单独安全评审           | 旧筛选响应不能覆盖新结果；管理员操作有明确主体和撤销方式（若采用个人身份）    |
| 3    | RoomSession、页面控制器拆分 | 在前两阶段真实状态契约稳定后，按职责迁移消费者               | 房间退出释放资源；账号变化取消原意图；UI 不新增业务权威状态副本               |
| 3    | 构建产物、监控和性能        | 基于实际生产产物/设备数据，不凭依赖列表选框架                | 冷启动资源链、错误归属、后台动画、媒体保留与恢复演练达到约定指标              |

不提供没有基线支撑的“性能提升百分比”或精确工期。每个工作包开始前列出文件、改动和风险并确认；交付以场景通过和旧错误路径消失为准，而非新增抽象数量。评估本身不授权实施这些改动。

## 验证记录

本次会话已执行的基线：

| 检查                                                                                                          | 结果                           | 不能证明的内容                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| 根项目 `pnpm exec tsc --noEmit`、`pnpm run knip`（本会话前段）                                                | 通过                           | 不等于整个 workspace typecheck/quality 通过          |
| 架构边界、权威边界、RoomSession、CFRealtimeService：4 个 Jest 文件（前段）                                    | 5594 项通过                    | 大量是按生产文件生成的静态规则，不是 5594 个业务流程 |
| GameRoom、inbox、roomSaga：3 个 Worker 文件（前段）                                                           | 27 项通过                      | 未覆盖 F01/F02 的真实跨层组合                        |
| tokenAuth、抽卡重放/日奖励、结算、词库 workflow、画作、头像、后台：8 个 Worker 文件                           | 48 项通过                      | 外部供应商使用测试配置/替身；不证明真实生成质量      |
| SettingsService、runGachaOperation、GachaOperationStore、AudioService、ActiveRoomSessionOwner：5 个 Jest 文件 | 38 项通过                      | 设置持久化失败、真机音频和完整 UI 仍有缺口           |
| 两个源码隔离探针（前段）                                                                                      | F01 协议关闭、F02 回执冲突复现 | 不是生产数据库/浏览器端到端重现                      |
| 本地页面检查                                                                                                  | F03/F06/F07 有运行证据         | 仅开发环境 Chromium 与上述页面样本                   |

Worker 测试输出包含 workflow 失败路径的 quota exhausted 和运行时 dispose 日志，但测试汇总为 8/48 全通过；没有将这些日志视为生产错误。没有重跑全仓 quality、完整 E2E、生产构建或部署。用户终端中的历史 quality 成功不作为本报告独立验证结果。

建议新增测试集中在上述已知故障窗口，不按每层重复同一断言；保留架构边界检查，但减少把目录名、函数名固定成架构正确性的替代品。现有 E2E 文件主要覆盖房间/游戏，本次未发现独立的资产、反馈、后台专用 spec；不据此断言其他 spec 内完全没有相关断言。

## 文档与运营缺口

- [设计文档](DESIGN.md)仍引用不存在于当前主题目录的 themes.ts，而真实颜色在 colors.ts；[构建脚本](../scripts/build.sh)头部仍写 SW 版本处理，实际 HTML 主动移除 SW。应更新源文档与规则，不编辑生成副本。
- API Worker 指令里的日奖励 localDate 和旧结算 key 描述与当前实现不一致。旧说明会诱导后续修改错误；本次只记录，不改其他文档。
- CDN 发布前做了资源可见性等待，这是有效保障；还缺乏本次对完整实际发布资源依赖、源映射对应关系和回退流程的验证。
- R2 生命周期配置在 Wrangler 注释中说明由外部命令管理；不能把注释当生产配置已生效。D1 容量、索引、备份和恢复同样需要运行证据。
- AI 词库真实产出数量、可接受比例、来源质量与成本未验证；任何实现优化后的验收都需要本地真实生成与人工审阅，不以 mock 或部署成功代替。

## 官方资料与证据边界

2026-09-17 查询的官方资料用于约束方案，不代表已经完成库版本迁移：

- [React Native Dimensions](https://reactnative.dev/docs/dimensions)：窗口尺寸可能变化，不应缓存用于布局的初始尺寸；React 组件优先 useWindowDimensions。
- [React Native useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions)：响应窗口及字体缩放变化。本次 Context7 返回 current/main 等文档，不把其中版本标号当项目版本。
- [TanStack Query useQuery](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)：查询数据与错误可以同时存在，需区分首次错误与重新获取失败；不通过伪造 initialData 解决 F03。
- [Cloudflare DO storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)（本会话前段）：对象内事务持久化与跨系统副作用是不同一致性边界。
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)（本会话前段）：确定性 JSON 表示的参考；不声称项目 canonicalJson 实现完全符合 JCS。

最终状态：**DONE_WITH_CONCERNS**。全系统架构评估及 F01–F10 实施记录已形成，各项独立提交并推送；F08 按用户决定保留并行 E2E。文档明确保留的结构建议、运行、安全、真机、性能和生产配置验证不在已完成声明内。

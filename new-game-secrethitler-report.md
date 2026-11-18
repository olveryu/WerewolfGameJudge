# 秘密希特勒（secrethitler）接入报告

> 已按用户要求开放创建目录；未部署、未激活 E2E CI。房间布局已调整，完整浏览器复验待继续。

## 生成与范围

生成器已运行一次，游戏 ID 为 `secrethitler`，选择
`--capability identityViewing --capability audioOrchestration`。
展示名为“秘密希特勒”，`main` 档，5–10 人，默认 8 人。
不新增依赖、词库、工作流、HTTP 路由或 R2 素材，不修改其他游戏玩法。
角色卡暂用仓库现有通用空白立绘，并在进房时预加载公开角色图清单；
没有创建秘密身份相关图片或新增素材。

能力声明与接线合同一致：身份查看、揭牌动画、房主配置、机器人接管和音频编排开启；
`nightPhase`、阶段超时、机器人批量查看、词库及画廊关闭。
这里的一次性首夜是本游戏阶段，不复用狼人杀专有夜晚能力。

## 九步处置

1. **设计定稿：已完成。** 唯一设计文档为
   [secrethitler-game-design.md](docs/secrethitler-game-design.md)，包含 11 项需求、
   角色与轨道表、完整阶段和命令、信息边界、奖励、统计、测试及非生产上线门槛。
   原先重复的摘要与完整方案已合并，并登记在文档索引。
2. **玩法填空：已实现并验证。** 引擎负责身份与政策洗牌、所有首夜确认、
   提名/秘密投票与改票、任期限制、立法、否决、调查、特别选举、处决、政策预览、
   四种正常终局及重开。Worker 命令使用严格 schema，客户端仅提交意图。
   无 `TODO(gameplay)` 残留。按用户确认的修正规则，首任总统从全部已入座座位选取，
   包括机器人；纯机器人房间也可以分配身份。
   回归覆盖政府当选不清零失败计数、第三次失败的否决自动施政、
   拒绝否决后不得再次请求，以及自由派施政不重触发法西斯轨道权力。
3. **本局复盘：已实现并验证。** 使用共享 `useRoomReview` 和封闭块词汇，
   展示阵营胜负、全员身份及处决状态、完整公开投票、政策和总统行动记录；
   不包含手牌、弃牌、私密调查或未揭晓选票。终局提供共享复盘、
   再来一局及返回大厅入口；重开后上一局复盘不可继续打开。
4. **奖励与战绩：已按批准口径实现并验证。** flat 33 XP、3 次普通抽奖、
   每日完成目标 1，不加胜者奖励。正常终局且开局至少 5 名真人才结算；
   游客计入人数门槛但不领奖或累计账户统计，机器人不计人数。
   注册参与者计完成局数和对应开局阵营胜场，被处决不失去资格。
   终局 v2 事实与奖励名单按座位顺序对应；legacy 严格只发原奖励，不补造战绩。
   自有 D1 累计表、公共 DTO/parser/getter、catalog 统计面板均接通；
   设置与房间资料卡复用现有入口及奖励 inbox 缓存失效。
   胜率为对应阵营胜场 / 完成局数，0 局显示“暂无数据”，pending/error 不伪装成 0。
   Worker 测试覆盖匿名过滤、原子失败回滚、重放幂等、账户删除级联及读写预算。
5. **迁移审查：已完成本地审查和验证，未应用生产。**
   `0090_secrethitler.sql` 扩展 `game_type` CHECK，按前一注册迁移重建受约束表及外键依赖，
   复制原数据并恢复原有约束和七个显式索引；源表无触发器。
   新增 `secrethitler_user_stats`，只存完成局数和两阵营胜场，user FK 级联删除，
   无逐局历史表或额外索引。
   `0090` 不重复删除 demo 数据；生成器已剔除从历史迁移继承的一次性 demo 清理，
   并添加真实源迁移回归测试。历史 `0088`、`0089` 未修改。
   一次性复制/索引重建成本随原表规模增长；生产行数与计费估值未验证，
   必须在实际部署前读取规模并评估，不以本地测试替代生产成本测量。
6. **E2E：按批准范围暂不启用。** spec 保持 `.spec.ts.tmpl`，
   不进入 CI 分片；未宣称完成真实多浏览器上下文的联网 E2E。
   本地浏览器检查使用真实引擎命令夹具、生产游戏 adapter、共享 `RoomShell`、
   `RoomStagePanel`、`BottomSheet`、`Button` 及共享复盘组件，不是静态仿制页面。
   已检查 1280、390、320 像素下的投票和终局布局，均无横向溢出或越界按钮；
   实际点击秘密投票后进入“修改选票”，私密弹层关闭；
   点击终局复盘可查看真实公开过程。终局核对胜负、自身/机器人标签、奖励资格、
   复盘/重开/大厅入口。临时预览文件已删除，专用预览服务已停止。
   截图保存在本次会话 `files/secrethitler-voting-desktop.png`、
   `files/secrethitler-ended-320.png`。
7. **词库：批准不适用。** 本游戏无需词库，`wordLibrary` 关闭，
   不注册 workflow、绑定或供词表。
8. **验收：已通过下表本地 scoped 检查。** 完整 quality 与全量 E2E 留给 CI，
   本地检查不等同于 CI gate。电子主持由房主设备承载中文语音，
   播报完成与获准座位确认齐全后由引擎自动推进；
   不显示人工朗读脚本，不提供人工朗读兜底、手动播报确认或手动推进命令。
   获准互认的座位仍须单独点“确认信息”，未齐不会推进。
   角色空白占位图通过共享 `useRoomImagePreload` 预加载；五条 MP3 由项目统一的
   Edge TTS 脚本按 canonical voice 生成，列入 `getSecrethitlerPreloadAudio` 的
   固定 `AudioClip` 清单，并由音频绑定的 `prepareQueue` 调用
   `AudioService.preloadClips` 缓冲。
9. **目录入口：按用户最新要求开放。** 设置 `isProduction: true`，
   同步首页生产过滤名单，使创建游戏列表包含秘密希特勒。本次未部署生产；
   正式部署前仍须确认名称/主题使用权并完成批准的上线验收。
   不复用原版插图、卡牌图案、版式或规则书原文。

## 本地验证

目录入口与纯机器人开局修正：引擎针对性测试 23 项、Web 目录与大厅测试 5 项通过；
引擎构建、Web typecheck 和修改文件 ESLint 通过。浏览器实测创建游戏的“主游戏”
列表已显示秘密希特勒。真人数量门槛仅用于结算奖励与统计，不限制分配身份。

以下为接入基线；电子主持修正后的重跑记录见下节。

| 检查                                 | 结果                           | 完整日志                                                                       |
| ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------ |
| 引擎玩法及受影响引擎合同             | 361 项通过                     | `/tmp/secrethitler-engine-tests.log`                                           |
| Web 游戏、复盘及引导合同             | 通过；生产过滤合同另已通过     | `/tmp/secrethitler-web-tests.log`                                              |
| Worker 游戏、统计及 catalog          | 21 项通过                      | `/tmp/secrethitler-worker-tests.log`                                           |
| Root architecture 与 CI E2E coverage | 6686 项通过                    | `/tmp/secrethitler-contract-tests.log`                                         |
| 生成器隔离合同                       | 通过，含能力组合与注册迁移夹具 | `/tmp/secrethitler-generator-tests.log`                                        |
| 引擎 build                           | 通过                           | `/tmp/secrethitler-engine-build.log`                                           |
| Web build 与路由 gzip 预算           | 通过                           | `/tmp/secrethitler-web-build.log`                                              |
| Root 与引擎测试配置 tsc              | 通过                           | `/tmp/secrethitler-root-types.log`                                             |
| Web typecheck                        | 通过                           | `/tmp/secrethitler-web-types.log`                                              |
| Worker typecheck / 生成绑定核对      | 通过                           | `/tmp/secrethitler-worker-types.log`                                           |
| 改动文件 ESLint / Prettier           | 通过，0 lint warning           | `/tmp/secrethitler-lint.log`、`/tmp/secrethitler-format.log`                   |
| Knip                                 | 通过                           | `/tmp/secrethitler-knip.log`                                                   |
| new-game 只读检查与 validate:agents  | 通过                           | `/tmp/secrethitler-integration-check.log`、`/tmp/secrethitler-agent-check.log` |

### 电子主持修正复验

- 引擎及受影响合同 360 项通过；覆盖 5–10 人互认、先播完/先确认两种顺序及旧批次确认不跳步：
  `/tmp/secrethitler-auto-night-engine-contracts.log`。
- Web 与共享音频、复盘及引导合同 92 项通过；覆盖删除朗读脚本和手动入口、
  必需语音失败不确认批次、重试成功及其他游戏默认行为不变：
  `/tmp/secrethitler-auto-night-web.log`。
- 角色占位图 registry 与共享图片预加载、TTS cue 列表及播放准备失败重试均覆盖在 11 个测试文件、
  47 项通过的 Web 回归中：`/tmp/secrethitler-preload-web.log`。
- Worker 12 项通过，包含旧手动推进命令拒绝：
  `/tmp/secrethitler-auto-night-worker.log`。
- Root architecture 6676 项通过：
  `/tmp/secrethitler-auto-night-contracts.log`。
- 引擎/Web 构建、Root/引擎测试/Web/Worker 类型检查、ESLint、Prettier、Knip 均通过；
  日志为 `/tmp/secrethitler-auto-night-{engine-build,web-build,root-types,engine-types,web-types,worker-types,lint,format-check,knip}.log`。

### 预生成音频接入复验

- 使用 Edge TTS 7.3.1 的 v2 token 与仓库 canonical voice/参数生成五条 MP3，
  并通过 ffprobe 确认五个文件均为有效 MP3 且时长非零。
  本次仅音频生成命令按用户批准使用 `--insecure` 应对代理证书链；运行时播放本地打包资源，
  不联网，也不关闭证书校验。
- 拉取 main 后，new-game skill 新增了公开房间图片清单与音频 `prepareQueue` 预加载要求；
  本次也明确规定旁白使用项目 Edge TTS 预生成 MP3 pipeline，不用浏览器 `SpeechSynthesis`。
  本局仅预载公开占位立绘，五条音频通过 `getSecrethitlerPreloadAudio` 接入。
- main 同步后，Secret Hitler、共享音频、图片预加载、阿瓦隆与狼人杀相关 Web 测试
  74 项通过（14 个测试文件）；Web/root typecheck、Web build、new-game 检查、
  `validate:agents`、Knip、ESLint、Prettier 与 diff whitespace check 均通过。
  Web 测试、typecheck、build、new-game 检查、agent 检查、Knip 和 root typecheck
  日志分别为 `/tmp/secrethitler-main-sync-web-tests.log`、
  `/tmp/secrethitler-main-sync-web-types.log`、`/tmp/secrethitler-main-sync-web-build.log`、
  `/tmp/secrethitler-main-sync-new-game-check.log`、
  `/tmp/secrethitler-main-sync-agent-check.log`、`/tmp/secrethitler-main-sync-knip.log`
  与 `/tmp/secrethitler-main-sync-root-types.log`。
- generator contract 1 项、`scripts/new-game.test.mjs` 27 项通过；
  日志为 `/tmp/secrethitler-main-sync-generator-contract.log` 与
  `/tmp/secrethitler-main-sync-generator-tests.log`。

## 已知边界

### 本次共享房间布局修正

- 秘密希特勒全阶段保留共享座位盘，复用 `RoomGameSummary`、可折叠 `BoardInfoCard`、
  `RoomRecordSummary` 和 `RoomDialog`；私密调查结果从公共区域移到底部个人操作。
  阿瓦隆摘要同时改用共享组件，保留原有待操作座位和记录入口。
- 生成器按已有 `identityViewing` 能力生成身份游戏布局；无身份分支保留工作区。
  new-game skill 与能力说明同步约束模板，不新增第二个游戏类型开关。
- 本次 Web 回归 97 项、引擎 33 项、Worker 12 项、root architecture 6700 项通过；
  生成器合同通过，包含真实工具链能力组合夹具。引擎/Web 构建、Web/Worker/root 类型检查、
  Knip 与 agent 文件校验通过。日志为
  `/tmp/secrethitler-room-web-retest.log`、
  `/tmp/secrethitler-room-generator-retest.log`、
  `/tmp/secrethitler-commit-{engine-tests,worker-tests,contracts,engine-build,web-build,web-types,worker-types}.log`。
- 本轮浏览器仅检查了独立本地房间大厅；此前投票和终局截图对应旧版界面，
  不作为新布局完整浏览器验收证据。先按用户要求保存并推送分支，再继续界面测试。

- 沿用线下社交信任模型：私密字段通过 viewer view model 控制 UI，
  原始状态仍按平台现有方式广播，不承诺抓包或开发者工具级防作弊。
- 播报是否获得自动播放权限取决于浏览器；播放失败时明确报错并保留音频门，
  检查设备权限后刷新重试，不跳过播报或切换成人工主持。
- 未创建 PR 或生产部署；未运行联网多真人 E2E。

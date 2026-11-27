# 一眼成对（spotmatch）接入报告

## 最新视觉收敛与验证

- 每牌使用稳定种子生成随机坐标，并限制任意高度为牌面内部高度22%的水平带最多三个图案，避免明显四图案横排。
- 最新1000组布局测试覆盖稳定性、水平分散、52像素目标的边界与间隔；web相关测试8文件36项、typecheck和ESLint通过。
- 更新后真实双人Playwright在320×568、375×667、390×844三档通过；浏览器当前断言目标至少44像素。

- 牌面改为圆角横向长方形，八个图案按每牌种子错层散布；已出的牌独立飞行，下方即时补牌，三秒暂停只阻止操作。
- 四款舞台共用 `RoomStageHud` / `RoomStagePanel`，删除一眼成对的重复描边、阴影与面板颜色实现。
- 终局采用赢家奖杯面板与共享 `RoomRanking`；后者从你画我猜计分板提取，原有计分/并列/互动数量语义保持不变。
- 新游戏 skill 与 web 区域规则明确要求对照已有 HUD/结束页，并验收终局、排名、奖励提示和共享操作入口。
- 下方为历史阶段记录，不表示本轮已完成验证；最新浏览器/测试证据另列。

本轮验证：四款游戏及共享组件/样式/边界共54文件293项测试通过；web与根TypeScript、knip、改动文件ESLint和web构建通过。
Agent文件校验通过，保留仓库既有797条警告；构建仍提示原有大chunk与Vite配置加载警告，不视为零警告。
现有 `spotmatch.spec.ts` 使用2个独立真人context，在320×568、375×667、390×844三档全部通过。
每档断言双横牌完整可见、8个目标≥44像素、无重叠/越界，并验证两位玩家终局排名行不被标准底部操作遮挡。
已查看320与390牌桌/结束页截图；320结束页通过容器查询收紧赢家面板，仍保留完整两行排名。
截图位于 `test-results/spotmatch-Spotmatch-two-real-players-finish-on-<尺寸>-chromium/cards-<宽>.png`
与同目录 `results-<宽>.png`。复盘打开/关闭、再来一局/返回大厅沿用共享外壳；本spec验证复盘与返回大厅。
没有提交、推送、远程CI或生产迁移；没有将本地浏览器结果冒充远程验收。

## 2026-11-17 后续交互反馈

- 两张当前牌均可点击，同一claim携带局号、公共牌实例、本人实例和符号；两牌共享单飞。
- 引擎验证双牌并集，仅一牌存在的符号记一次误点/本人1000ms锁；并集外非法、过期不罚。
- 正确出牌服务端全桌暂停3000ms，公开匹配符号、出牌者与旧公共牌；按绝对截止时间显示，不因回执/重连重开暂停。
- 最后一张先完成同一成功反馈，再切终局壳/复盘入口；奖励effect仍只产生一次。
- 误点红框/锁定文字由权威状态驱动；成功绿框/出牌者全桌可见；stale仅内联提示，保留平台日志，网络/权限异常不被吞掉。
- 已按当时反馈将状态区移到牌桌顶部、保留清楚双牌标题，网络只用共享连接条；
  最新请求已转为先看设计方案，因此停止进一步视觉/排版修改，当前样式不是新一轮设计定稿。
- 删除额外“测试局”标签，内部isTest仍按冻结机器人名单保留，含bot仍不计奖励/战绩。
- v2显式迁移旧v1房间，不清空旧牌/计数/锁定；错误符号元数据仍按本人/host代控bot裁剪。

本轮日志：工作树内 `sessionfiles/spotmatch-feedback-*.log`；精确33个改动文件列于
`sessionfiles/spotmatch-feedback-files.txt`（不含本轮scratch/log）。
最终通过：引擎/截止与架构契约333项，web51项，Worker14项，root架构/E2E登记契约6483项；
单个现有Playwright spec三视口3/3（57.5秒），root/web/worker typecheck、engine build、
knip、精确改动文件eslint/prettier。
真实截图在 `test-results/spotmatch-Spotmatch-two-real-players-finish-on-320x568-chromium/cards-320.png`
及对应375/390目录；320截图已查看，双牌完整、无额外局型标签、名单与剩牌同行，目标≥44由浏览器断言。
上下牌误点、stale无弹窗、全桌暂停边界、终局反馈顺序均有引擎/组件测试；
本轮尚未另做机器人代控视口与双真实浏览器红/绿瞬间截图，不冒充已完成。
现有5175/8787健康检查均200，未手动重启/停止服务；旧页面热更新时曾见provider失配，
完整刷新后恢复，后续两次单spec共6场真人局全部通过；未声称对原用户浏览器连接做过直接验证。
无commit/push/远程CI，后续动画/视觉方案由用户选择后再实施。

## 生成记录与约束

- 工作树：`WerewolfGameJudge-spotmatch-design`，分支 `docs/spotmatch-design`，起点 `0674df87c7f722cbe03c58f0f505a2078b24666d`。
- 生成器仅执行一次：`corepack pnpm new-game spotmatch --name 一眼成对 --subtitle '同时找相同，抢先出完手牌'`。
- 生成47文件、编辑17共享文件、报告另计；无`--preset`，所有可选能力关闭。
- 基础botsAndTakeover、hostConfig开启；无身份、deadline、音频、词库、gallery。
- 原设计在会话files中精确保留为`spotmatch-game-design.original.md`，现行完整设计已收敛全部历史冲突。
- 200个批准SVG和catalog保留在 `packages/web/src/games/spotmatch/assets/`；评审原型和重复资源已移除。
- 不commit、不push、不建PR、不远程dispatch；主checkout不修改。

## 9步处置

### 1. 设计定稿：已实现

`docs/spotmatch-game-design.md`保留完整20节并补11项需求表。
最终2–20人默认4、每人5/8/10/15默认8、无比赛时限、首空立即结束。
3秒开局是未独立批准的草稿建议，简化为一次原子开始并亮牌，不为此启用stageDeadline。
沿用共享进行中座位冻结，不凭空增加退赛/DNF或人数不足自动终局。
README仅恢复本设计索引行，其他行不变。

### 2. 玩法填空：已实现并有行为证据

- PG(2,7)57牌型，8点/牌，1596对全检；每局从200选57互异素材映射。
- 中央与20人顶牌互异，140次连续动态出牌超过57，其他玩家顶牌与布局保持不动。
- 每次出现唯一实例；牌型回归不接受旧实例。
- 权限/阶段/实例校验先于误点归类；旧中央不罚、错符号提交domainRejected与事件、本人精确1000ms锁定；
  正确出牌改为服务端全桌共享3000ms暂停；HTTP receipt重放只计一次误点。
- 原子更新中央/个人计数/新顶牌；首空同次结束；host-only中止不产出结算。
- Worker可选通用projectStateForUser，在HTTP新/重放回执与WS sync/broadcast之前裁剪其他真人top；
  host只能看到自己和代控所需bot牌，不能看到其他真人牌；旧游戏缺省不变。
- web真实共享stage、八符号双圆牌、共享20人名单抽屉和比赛标题栏host管理；
  素材提前解码、无乐观游戏更新、断线禁用、稳定布局、图案中文名称/键盘焦点，无阻塞动画。

### 3. 本局复盘：已实现并验证文档

游戏使用标准RoomReviewContribution/Document、平台唯一弹窗与导出分享。
包含赢家、按剩牌竞赛排名、全员剩牌/正确/误点；按最新反馈不显示“测试局”标签。
真实引擎打到首空终局的fixtures供本游戏与跨游戏review/guidance契约使用。
host、参与者、旁观者均可review；终局标准再来一局/大厅保留。

### 4. 奖励与战绩：已实现并验证D1链路

用户确认flat5XP、1普通抽奖、日目标5。冻结真人至少2（匿名计门槛），任一bot整局test，
自然首空且本人≥1正确张；Worker现有注册门排除匿名持久奖励/统计。
赢家先按全体参与者决定，之后才筛接收者，不重派胜利。
已实现gamesPlayed、wins、correctCards、mistakes和wins/gamesPlayed（零分母“—”）。
严格v2事实与DTO、owned D1/schema/getter、原子reward+stats幂等、设置catalog与房间资料卡同组件同query，
奖励inbox沿现有query-key失效，不新增缓存通道；legacy只奖励、畸形v2拒绝。
时间completedAt为注入Unix整数毫秒；新游戏无历史，不补造历史指标或反应速度统计。

### 5. Migration审查：已实现并验证保留性

反馈版状态升级至v2，显式接受v1持久房间：保留牌面、计数和原误点锁，
仅补success/lastMistake为null；不清房、不重置D1。新增公开成功回放元数据不包含未出手牌。

`0089_spotmatch.sql`按最新物理编号生成，前注册源为0088。
重建rooms、room_game_starts、room_participants、fib_round_word_selections、
undercover_round_word_selections、product_game_reward_results，保留约束/外键、数据和7个显式索引，无新增触发器。
只为新游戏创建spotmatch_user_stats：user_id主键、账号删除级联，四非负整数、wins≤gamesPlayed。
保留性测试重跑迁移验证旧room/participants/start与全部显式index。
一次性成本=六表各全量读/写一次+索引重建；**尚无生产行数，部署前仍需实数预估，未应用远程迁移**。
累计查询主键查单用户；8/256无关账号时≤2读行；一次统计增加最多2写行/索引项，重试不重复。
不加二级索引，不增加独立历史账本或幂等系统。

### 6. E2E启用：已实现，远程未运行

已按本次明确要求将模板替换成真实`e2e/specs/spotmatch.spec.ts`，专用page object复用共享helpers。
2个独立真人contexts，无bot；320×568、375×667、390×844三种视口，真实建房/配置/点牌、
对方top不变、首空终局、标准review/返回大厅。八目标≥44像素、无重叠/圆内边界与完整视口均由浏览器测量。
仅登记`.github/workflows/ci.yml`一个shard，CI coverage contract检查。
本地单spec最终3/3通过（56.9秒），320/390实际渲染截图已人工查看，三尺寸截图均随测试留存。
**未获远程修改许可，不push、不dispatch单spec；不能声称远程CI通过。**

### 7. 词库：明确不适用

批准形态none；不需要AI/word supply，不声明workflow、不改binding/Env，无BGM/语音/gallery。
共享stage不意味着启用stageDeadline。

### 8. Scoped门禁：本地全部通过，远程未运行

采用skill要求的本游戏测试、直接受影响契约、root tsc、web/worker typecheck、
engine build、knip、changed eslint/prettier；完整quality和全量E2E只留CI。
初轮真实测试已定位并修复生成fixtures仍直接结束骨架游戏、旧配置缺cardsPerPlayer、
共享seat composition漏注册、unused空rules等问题，不用弱化期望掩盖接线缺失。
完整命令日志保存在会话目录：
`/Users/eyan/.copilot/session-state/3742fe37-efdb-4a8a-a641-e0f20ea430a3/files/spotmatch-*.log`。

### 9. 生产入口：代码已对齐，远程上线未执行

registry.isProduction与homeProductionFilter名单一致，首页可创建真实玩法。
这不是部署证明；本次无commit/push/PR/远程迁移或CI结论。
真实20端竞争负载/时延、微信web-view、至少两部真机误触/辨识以及生产迁移行数成本仍待发布前人工验收，
不以20人引擎测试或桌面模拟视口冒充完成。

## 验证记录

全部命令在目标工作树执行；以下最终状态均取命令自身退出码，全部为0。
日志根目录为`/Users/eyan/.copilot/session-state/3742fe37-efdb-4a8a-a641-e0f20ea430a3/files/`。

| 验证                                          | 最终结果                                      | 完整日志                                                |
| --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Engine scoped玩法、配置、能力、registry、架构 | 9 files / 360 tests通过                       | `spotmatch-engine-tests.log`                            |
| Engine变更的共享命令契约                      | 1 file / 6 tests通过                          | `spotmatch-engine-command-contracts.log`                |
| Worker游戏、catalog、通用DO                   | 5 files / 47 tests通过                        | `spotmatch-worker-tests.log`                            |
| Web游戏、复盘、引导、生产入口、样式契约       | 10 files / 67 tests通过                       | `spotmatch-web-tests.log`                               |
| Web变更的共享bot dispatch契约                 | 1 file / 20 tests通过                         | `spotmatch-bot-contracts.log`                           |
| 两个新增冷却测试最终复跑                      | 1 file / 2 tests通过（包含于上项）            | `spotmatch-cooldown-tests.log`                          |
| 根架构与CI E2E覆盖                            | 2 files / 6483 tests通过                      | `spotmatch-contracts.log`                               |
| Playwright真实双context，三尺寸               | 3 / 3通过，56.9秒                             | `spotmatch-browser.log`                                 |
| root tsc、web/worker/E2E typecheck            | 全部通过；Worker含binding和测试类型检查       | `spotmatch-{root,web,worker,e2e}-tsc.log`               |
| Engine build、Web生产build                    | 通过；home gzip1604.7 / 2000KiB               | `spotmatch-engine-build.log`、`spotmatch-web-build.log` |
| changed eslint、prettier                      | 通过；不改原设计资产                          | `spotmatch-eslint.log`、`spotmatch-format-check.log`    |
| knip                                          | 通过；仅既有cloudflare配置hint                | `spotmatch-knip.log`                                    |
| new-game / new-e2e-spec检查器                 | 均通过；既有drawguess force例外行号提示不改动 | `spotmatch-skill-check.log`、`spotmatch-e2e-check.log`  |
| validate:agents                               | 0 failure，通过；现有文档警告为report-only    | `spotmatch-agents.log`                                  |

实际scoped命令（均以`corepack pnpm`启动；脚本例外）：

```sh
corepack pnpm --filter @game-judge/game-engine run build
corepack pnpm --filter @game-judge/game-engine run test src/games/spotmatch src/platform/__tests__/engineSkeleton.contract.test.ts src/platform/__tests__/gameRegistry.contract.test.ts src/platform/__tests__/phaseDeadlineVariants.contract.test.ts src/platform/engine/__tests__/capabilities.contract.test.ts src/platform/config/__tests__/configSchema.test.ts src/platform/__tests__/architecture.contract.test.ts
corepack pnpm --filter @game-judge/game-engine run test src/platform/engine/__tests__/contracts.test.ts
corepack pnpm --filter @game-judge/api-worker run test src/games/spotmatch src/games/__tests__/catalog.test.ts src/platform/room/__tests__/GameRoom.test.ts
corepack pnpm --filter @game-judge/web run test src/games/spotmatch src/__tests__/roomReview.contract.test.ts src/__tests__/roomGuidanceMatrix.contract.test.ts src/games/__tests__/homeProductionFilter.contract.test.ts src/__tests__/noHardcodedStyleValues.contract.test.ts
corepack pnpm --filter @game-judge/web run test src/__tests__/botDispatchDiscipline.contract.test.ts
corepack pnpm run test contracts/architecture.contract.test.ts contracts/ciE2eCoverage.contract.test.ts
corepack pnpm exec playwright test e2e/specs/spotmatch.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1
corepack pnpm exec tsc --noEmit
corepack pnpm --filter @game-judge/web run typecheck
corepack pnpm --filter @game-judge/api-worker run typecheck
corepack pnpm exec tsc -p e2e/tsconfig.json --noEmit
corepack pnpm --filter @game-judge/web run build
corepack pnpm run knip
corepack pnpm run validate:agents
.agents/skills/new-game/scripts/check-new-game.sh .
.agents/skills/new-e2e-spec/scripts/check-e2e.sh .
```

（`noHardcodedStyleValues.contract.test.ts` 已由 UI gate（`pnpm run lint:ui`，PR #519）取代并删除，上面是当时的原命令与结果。）

changed-file集合保存在会话`spotmatch-changed-files.json`；
使用`corepack pnpm exec eslint --max-warnings=0 <changed ts/tsx>`与
`corepack pnpm exec prettier --check <changed ts/tsx/css/json/md/yml>`验证，原`design-system/`不参与改写。
截图在`test-results/spotmatch-Spotmatch-two-real-players-finish-on-<尺寸>-chromium/cards-<宽>.png`。
缺失的impeccable skill尝试加载失败，未虚构执行；UI按既有`docs/DESIGN.md`、tokens和批准原画实现。
远程单spec/全量quality/E2E、远程迁移和真实设备事项未运行，不能视为通过。

最终隔离复核记录于会话`spotmatch-isolation.json`：目标分支及HEAD正确、主checkout干净且HEAD未变，
200份运行SVG与批准原画逐字节一致、原设计备份仍在、README除新增索引行外完全不变。
单spec结束后8787/8081均无遗留监听进程。上述非重复测试合计6983项单测/契约及3项浏览器场景通过。

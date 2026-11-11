# E2E 夜间 driver 加固方案

> 状态：已实施（2026-11-11）。本文保留原方案，并在第 12 节记录实际提交和阶段验证结果；最终清理后的 CI 结论以 PR Checks 的分支/SHA 为准。
> 范围：`e2e/helpers/night-driver.ts` 及依赖它的 15 个 spec，加 `pictionary.spec.ts` 的一处断言。不改产品行为。
> 交付方式：一个 PR，按提交拆分，靠 PR 上的 CI 验证。
> 本文所有“现状”核对自 2026-11-11 的源码（`main` @ `cc9ee3f`）；所有数字来自 CI run 43104180572 和 flake 台账（issue #220）。

## 1. 起因

CI run 43104180572 里 `werewolf-night-wolf-girl.spec.ts` 首次失败、重试后通过，报错是 `Guard should confirm protection`。

失败那次守卫恰好分给了主持人（P0）。主持人刚确认“开始游戏？”弹窗，弹窗还在退出。driver 把这张弹窗的消失当成了“守卫行动提示已出现”，提前判定守卫可以操作。当时语音还在播放，两次座位点击都被产品忽略，确认框没有出现。重试时守卫分给了 P3，没有这张退出中的弹窗，所以通过。

trace 里的时间线（毫秒）：

| 时间            | 观察                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| 354309          | 弹窗内容是“开始游戏？”                                                       |
| 354640          | 房间进入 `Ongoing/guardProtect`，页面显示“语音播报中…”                       |
| 354842 – 354899 | 弹窗 `isVisible()` 为真，但正文已卸载，`textContent()` 为空                  |
| 355264          | 弹窗不可见。driver 输出 `prompt cycle fired`，实际只是空字符串变成了“无弹窗” |
| 355530          | 第一次点击 4 号座位：座位 `data-inert="true"`                                |
| 365595          | 第二次点击：仍然 `data-inert="true"`                                         |
| 375606          | 真正的“守卫行动”提示才出现                                                   |

## 2. 影响面

- 33 个 spec 里有 15 个走夜间 driver：14 个 `werewolf-night-*`，加 `resilience-reconnect.spec.ts`。它们共有 259 处 `waitForRoleTurn`、`clickSeatAndConfirm`、`dismissAlert` 调用。
- 问题在共用的 driver 里，不在各 spec 的场景逻辑里。
- 其余 18 个 spec 不用这个 driver，没有发现同类问题。`pictionary.spec.ts` 有一处同族问题，见第 6 节。

### 2.1 基线数据

run 43104180572 全部 9 个 shard 的 driver 日志统计：

| 现象                                 | 次数                     | 涉及 spec 数 | 代价                              |
| ------------------------------------ | ------------------------ | ------------ | --------------------------------- |
| 等不到提示变化，空等 20 秒后照常继续 | 18                       | 11           | 约 360 秒，继续时没有任何就绪证明 |
| 点击 5 秒超时后被吞掉                | 24，其中 22 次是关闭弹窗 | 9            | 约 120 秒，失败不上报             |
| 从开始等待到判定就绪不到 1.5 秒      | 2                        | 2            | 其中 1 次就是本次失败             |
| 座位点击后没有确认框                 | 2                        | 1            | 本次失败的两次点击                |

flake 台账（10-19 至 11-11）共 90 条 e2e 记录，71 条在 `werewolf-night-*`。台账不记错误文本，不能断言它们都是同一个原因。

## 3. 根因

1. **就绪靠“弹窗有变化”推断。** `waitForPromptCycle` 把任何弹窗变化都当作当前步骤的提示出现，包括上一张弹窗退出，所以会误报。提示早于等待出现时又永远等不到变化，所以会漏报，空等 20 秒后照常继续。
2. **座位点击只等元素可见。** `clickSeatAndConfirm`、`driveMultiSelect`、`driveMagicianSwap` 点击前只等 `visible`。产品的业务锁是自定义属性 `data-inert`，不是原生 `disabled`，所以 Playwright 的点击会成功，但产品忽略它。
3. **`dismissAlert` 盲点，并且吞掉失败。** 它用一次性的 `isVisible()` 判断有没有弹窗，然后点“当前打开的那张”的主按钮，点不到就记一条日志继续。
4. **失败只返回 `false`。** spec 里有 204 处 `expect(x).toBe(true)`，失败时只能报出没有原因的消息。

### 3.1 产品侧有哪些信号可读

产品有四种情况会让一次点击不生效：

| 锁                                            | 产品行为                           | 测试能读到的信号                                             |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| 语音锁（`isAudioPlaying`）                    | 交互被拦截，底部夜间按钮整组不渲染 | `TESTIDS.audioWaitingMessage` 存在；座位 `data-inert="true"` |
| 提交中（`isActionSubmitting`）                | 座位网格禁用，夜间按钮禁用         | 座位 `data-inert="true"`；按钮禁用                           |
| 上一条命令待确认（`pendingDurableCount > 0`） | 交互被拦截，点击只弹 toast         | **没有**：座位不是 inert，按钮也不禁用                       |
| 座位级限制（`disabledReason`）                | 该座位不可选                       | 该座位 `data-inert="true"`                                   |

第三种锁没有任何可读信号，所以方案不能只靠“等锁解除”，还要在点击后验证结果（见 4.2）。

### 3.2 没有核实的点

- 22 次关闭弹窗超时的原因是推断。失败 trace 里出现过“弹窗可见但正文已卸载”的退出态（`AlertHost` 设了 `unmountOnExit`，退出动画 120 毫秒），和超时现象吻合。但通过的测试不留 trace，没有逐条确认。另一种可能是按钮在 `onPress` 未完成时被禁用。阶段 0 负责确认。
- 主持人的 `werewolf.audio.ack` 是否按 durable 命令发送。如果是，主持人页面在语音结束的瞬间会经过“上一条命令待确认”的窗口。方案不依赖这个结论。
- 引擎进入新步骤和置 `isAudioPlaying=true` 是否在同一次快照里。失败 trace 里第一个 `guardProtect` 快照已经带“语音播报中…”，只有这一个数据点。若不是同一次快照，4.2 仍然兜得住。
- 修复前能否稳定复现。条件是主持人是首步角色，并且命中开局弹窗的退出窗口，不保证能复现。

## 4. 阶段 1：driver 核心

改动文件：`e2e/helpers/night-driver.ts`、`e2e/helpers/alerts.ts`，以及 `e2e/pages/NightFlowPage.ts` 里的调用点。这一阶段不改任何 spec，helper 的签名和返回值保持兼容。

### 4.1 就绪改为读状态

- 判定条件：页面的步骤锚点 `data-step` 等于目标步骤，并且该页的 `TESTIDS.audioWaitingMessage` 不存在。
- `waitForRoleTurn`：锚点命中后，带截止时间地等语音锁解除。等待期间不扫其他页面，和现在一致。等待中锚点变了，就回到外层的扫描循环，也和现在一致。
- `waitForStepAndSettle`：用同一个判定。
- 删除 `waitForPromptCycle`、`promptCycleSeen`、`nightEpoch`、`noteNightEnded`、`PROMPT_CYCLE_CAP_MS`。`waitForPromptCycle` 只在 driver 内部用到 3 处。

### 4.2 座位操作：前置条件加结果验证

单目标座位步骤（`clickSeatAndConfirm`）改成一个有总时限的循环，每一轮做四件事：

1. 关掉当前打开的单按钮弹窗。步骤提示可能在解锁之后才出现。
2. 等目标座位 `data-inert="false"`。
3. 点击座位。
4. 短时间内等双按钮确认框出现。出现就确认，并等它关闭。没出现而且步骤锚点没变，就进入下一轮。

- 步骤锚点变了就立刻失败，不再点击。这沿用现有约定：单目标步骤里重复点击只会重开确认框，不会重复提交。
- 总时限沿用现在的 10 秒量级，轮间隔取几百毫秒。现在是 2 次、每次等 10 秒。
- 这一层覆盖 3.1 里没有信号的那种锁：点击被 toast 吞掉时没有确认框，下一轮重试。
- 每次重试记一条 driver 日志。这个计数是第 10 节里决定要不要加产品锚点的依据。

草稿式步骤（`driveMultiSelect`、`driveMagicianSwap`）不重试点击，因为重复点击会把选中状态切回去：

- 每次点击前等目标座位 `data-inert="false"`。
- 结果由已有断言验证：多选步骤的“（N人）”计数，魔术师的“已选择第一位玩家”提示。失败时抛出带上下文的错误。

### 4.3 `dismissAlert` 按状态操作

- 动作路径：弹窗处于退出态（可见但没有标题）时，先等它消失。点击主按钮后，等这一张弹窗关闭或被替换。失败就抛错，不吞。
- 扫描路径（`tryClickAdvanceButton`、`pollUntil`、`runNightFlowFor`、`waitForGroupConfirmStep`）：保留“这一轮点不到就下一轮”的语义，超时从 5 秒降到约 1 秒。
- `alertPrimaryButton`：弹窗里没有按钮时返回“没有按钮”，而不是退回去定位 `alertButton(0)`。
- 点击超时时，日志里记下弹窗当时的状态：有没有标题、几个按钮、按钮是否禁用。这样第一次推送的 CI 日志就能确认 3.2 的第一条。

### 4.4 失败带原因，返回值保持兼容

- 新增一个 driver 错误类型。消息里包含：在等哪个步骤、每个页面的 phase 和 step 锚点、目标页的语音锁状态、当前弹窗的标题。
- 这一阶段各 helper 失败时抛错，成功时仍然返回 `true`。spec 里现有的 `expect(x).toBe(true)` 不用改，阶段 1 可以单独验证。
- 原方案认为返回值只用于断言；实际类型迁移另外找出 5 处 `if (turn)`（见 12.1）。保留外层“角色在场”条件，必需步骤直接等待，失败由 helper 抛错。
- `waitForRoleTurn` 遇到“夜晚先结束了”现在返回 `false`，调用方全部断言 `true`，所以也改成抛错。

## 5. 阶段 2：spec 里的裸操作

| 位置                                                                                                            | 问题                                                                              | 改法                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `werewolf-night-wolf-girl.spec.ts` 的 `expectWolfSeatNotConfessable`                                            | 裸点击，固定等 300 毫秒，再一次性读弹窗。点击若因语音锁被忽略，这个否定断言会空过 | 先断言页面已解锁（同一步骤里有可选座位是 `data-inert="false"`），再断言狼人座位 `data-inert="true"`，点击后用自动等待的断言确认没有“确认表白” |
| `werewolf-night-special-roles.spec.ts:321`                                                                      | 裸座位点击                                                                        | 点击前等该座位的预期状态，改用 driver 的座位操作                                                                                              |
| `werewolf-night-seed-wolf.spec.ts:79`、`werewolf-night-protect.spec.ts:125`、`werewolf-night-piper.spec.ts:235` | 直接操作弹窗                                                                      | 已经用了自动等待的断言，只复核是否按标题识别弹窗                                                                                              |
| 11 个 spec 里的 36 处 `readAlertText`                                                                           | 就绪判定变快以后，读到的可能是上一张残留的弹窗                                    | 逐处分类。读自己动作之后的结果弹窗是安全的。读步骤提示的，改成按预期标题用 `toHaveText` 等待                                                  |
| `pictionary.spec.ts:297`                                                                                        | 见第 6 节                                                                         | 一次性读数改成轮询                                                                                                                            |

## 6. `pictionary.spec.ts` 的 flaky

台账里 pictionary 的 14 次属于两个不同的测试。

### 6.1 `four real players complete a prompt-first relay and synchronized gallery`：13 次，仍可能复发

- 10-19 至 11-02 共 13 次。只读到最后一次（run 41520049146，`main` @ `2b9d009`）的错误信息，其余 12 次的错误文本拿不到。
- 那一次首次失败、重试通过，报错是 `expect(failedUploads).toBeGreaterThanOrEqual(3)`，实际收到 0。
- 那次 run 的 trace 已过期，下面的机制来自读代码，没有 trace 佐证。

spec 的这一段做了四件事：

1. 让第 4 个玩家的页面按下鼠标、画到一半不松手。
2. 拦截 `**/submissions/**`，每命中一次就计数并中断请求。
3. 等任务说明变成“发送暂未成功，正在自动重试。”
4. 立刻断言拦截计数不少于 3。

第 4 步假设“出现重试提示”就意味着“上传已经失败了 3 次”。产品不保证这一点。`usePictionaryAutoSubmission` 有两条路径会显示这条提示：

- 上传路径：请求最多尝试 `FETCH_RETRY_COUNT + 1` 次，也就是 3 次，全部失败后显示提示。这时计数不少于 3。
- 前置检查路径：连接不是 `live`，或者还有命令待确认时，不发任何请求，直接显示提示。这时计数是 0。

被测页面正好是同一步骤里刚断网又恢复的那一页。收稿开始时它的连接如果还没恢复，就走前置检查路径，提示先出现，计数是 0。连接恢复后产品会重新走上传路径，计数随后会涨上去，只是 spec 没有等。

这个分支在失败提交的旧客户端里存在，11-09 移植后的 web 客户端保留了它，spec 的断言也没变，所以今天仍可能复发。11-02 之后没有再出现，原因不明：11-09 之后 `main` 上完成了 18 次 CI，台账没有新的 pictionary 记录。可能是新客户端的时序不同，也可能只是样本少，不能当作已经修好。

改法：把第 4 步改成 `expect.poll`，轮询到计数不少于 `FETCH_RETRY_COUNT + 1`。测试意图不变，仍然证明“有重试提示”并且“确实重试了 3 次以上”，只是不再要求两者的先后顺序。超时按 `FETCH_RETRY_BASE_MS` 的退避和 `UPLOAD_RETRY_LADDER_MS` 算出上界。

### 6.2 `phase advances past the deadline with zero expire commands while every client is offline`：1 次，不用处理

- run 41964679730，提交 `6ad3422`（11-04）。断言“客户端发出 0 条 `pictionary.phase.expire`”，实际收到 1 条。
- 这个提交早于 `015f0d7`（11-05，删除了五个游戏客户端的 `phase.expire`）。当时客户端确实还会发这条命令，测试抓到的是真实行为。
- `015f0d7` 之后没有复发。

## 7. 阶段 3：清理样板断言

阶段 1 之后，helper 失败会先抛错，spec 里对返回值的断言就成了冗余。

| helper                    | 处数 |
| ------------------------- | ---- |
| `waitForRoleTurn`         | 128  |
| `waitForNightEnd`         | 58   |
| `waitForGroupConfirmStep` | 9    |
| `clickSeatAndConfirm`     | 8    |
| `waitForStepAndSettle`    | 1    |

另有 3 处 `toBe(true)` 没有归到 helper 上（`werewolf-night-check`、`werewolf-night-kill`、`werewolf-night-flow` 各 1 处），需要人工看。

做法：

1. 把 `const x = await helper(); expect(x, '说明').toBe(true);` 改成 `await helper();`。断言说明里如果有场景信息，挪到 `test.step()` 的标题里。
2. 按 CI shard 分四批提交：
   - 批 A：`block`、`seed-wolf`、`special-roles`
   - 批 B：`protect`、`gargoyle`、`kill`、`special-roles-2`
   - 批 C：`gun-status`、`check-interactions`、`check`、`piper`、`wolf-girl`
   - 批 D：`flow`、`completion`、`resilience-reconnect`
3. 最后一个提交把这些 helper 的返回类型从 `Promise<boolean>` 改成 `Promise<void>`，让 TypeScript 找出漏掉的调用点。

### 7.1 什么时候做

放在同一个 PR 里，作为最后一组提交，条件是阶段 1 和阶段 2 的那次推送在 CI 上通过，并且 8.2 的计数归零。

- 之前倾向于推后，理由是每个改过的 spec 都要单独跑一次 CI，共 15 次。按“一个 PR、推上去让 CI 自己跑”的方式，一次推送就把所有 spec 跑一遍，这个成本不存在了。
- 这一步只有在阶段 1 之后才安全，所以必须排在后面。
- 留到以后做，同样的 15 个文件要再动一次，这段时间里新写的 spec 还会照着旧写法抄。
- 风险是 204 处机械改动和行为改动混在一个 PR 里，CI 红了不好定位。用分次推送解决：阶段 1 推一次，阶段 2 推一次，阶段 3 再推一次，每次红了都只可能是刚推的那一组。

## 8. 提交清单与验证

### 8.1 提交

| 序号    | 阶段 | 提交                                                                              |
| ------- | ---- | --------------------------------------------------------------------------------- |
| 1       | —    | `docs(e2e): add the night driver hardening plan`（本文和索引登记）                |
| 2       | 1    | `test(e2e): wait for the audio lock to lift before a role acts`（4.1）            |
| 3       | 1    | `test(e2e): verify the confirm dialog after a seat tap`（4.2）                    |
| 4       | 1    | `test(e2e): dismiss alerts by state and stop swallowing capped clicks`（4.3）     |
| 5       | 1    | `test(e2e): throw night driver errors that carry the room anchors`（4.4）         |
| 6       | 4    | `docs(e2e): record the readiness and alert rules`（第 9.1 节）                    |
|         |      | **第一次推送，等 CI**                                                             |
| 7       | 2    | `test(e2e): prove a wolf seat is unconfessable only after the page unlocks`       |
| 8       | 2    | `test(e2e): drive the special-roles seat tap through the night driver`            |
| 9       | 2    | `test(e2e): read step prompts by their title`                                     |
| 10      | 2    | `test(e2e): poll the pictionary failed-upload count`                              |
|         |      | **第二次推送，等 CI**                                                             |
| 11 – 14 | 3    | `test(e2e): drop redundant night driver result assertions`（批 A 到批 D，各一个） |
| 15      | 3    | `test(e2e): return void from the night driver helpers`                            |
| 16      | 4    | 可选：`build(eslint): forbid raw seat tile clicks in specs`（第 9.2 节）          |
|         |      | **第三次推送，等 CI**                                                             |

### 8.2 每次推送怎么判定

1. 用 actions API 读这次 run 的 `conclusion`，并核对 `head_branch` 和 `head_sha`。不用管道里 watch 命令的退出码判断。
2. 读 PR 上的失败摘要评论：15 个用到 driver 的 spec 和 `pictionary.spec.ts` 不能出现在 flaky 列表里。CI 配了 2 次重试，run 是绿的不代表没有 flaky。
3. 从各 shard 的 `blob-report-*` 里重算 2.1 的四个计数。“空等 20 秒”和“点击超时被吞”应该是 0，“座位点击后重试”的次数记录下来。

flaky 是概率事件，单次全绿不算证明。三次推送等于把全部 spec 跑了三遍，以三遍的计数都归零为准。

### 8.3 本地检查

- `pnpm exec eslint <改动的文件>`、`pnpm exec prettier --check <改动的文件>`、`pnpm run knip`。
- `.agents/skills/new-e2e-spec/scripts/check-e2e.sh .`。
- 改了 agent 文件以后跑 `pnpm run validate:agents`。
- `pnpm exec tsc --noEmit -p e2e/tsconfig.json` 可独立检查 E2E，也已接入 root `pnpm run typecheck` / CI。原有的 `@/` 别名错误在用户追加范围后修复，见 12.4。
- 本地能起服务时，挑一个 3 人局、首步是 `guardProtect` 的用例加 `--repeat-each` 反复跑。`werewolf-night-completion.spec.ts` 第 175 行附近和 `werewolf-night-protect.spec.ts` 第 46 行附近各有一个。主持人是守卫的概率每次三分之一，日志里出现 `rolePage=P0` 才算覆盖到了这次出问题的路径。

### 8.4 阶段 0：推送前先做的事

1. 记下 2.1 的基线数字，作为后面三次推送的对照。统计脚本不入库。
2. 试着在修复前复现一次（见 8.3 最后一条）。复现不了不阻塞。
3. 3.2 的第一条靠 4.3 新加的日志在第一次推送后确认。如果原因是按钮被禁用而不是退出态，4.3 的动作路径改成等按钮可用。

## 9. 阶段 4：防止回退

### 9.1 规则写进文档

- `e2e/helpers/README.md` 的 “Required Test Patterns” 加三条：
  1. 就绪读状态（步骤锚点、锁信号），不从弹窗的变化推断。
  2. 不盲关弹窗。动作路径按标题识别弹窗，关闭后确认它已经关闭。
  3. 否定断言要先有正向前提，证明这次操作在当时是会被产品处理的。
- `.agents/skills/new-e2e-spec/references/` 下的 `patterns.md`、`rules-and-verification.md`、`helpers-pages.md` 同步 helper 的新行为和这三条规则。`e2e/AGENTS.md` 的 Interaction rules 加一行。

### 9.2 可选的机械约束

- 在 `eslint.config.mjs` 的 `e2e/**` 规则块里，禁止 spec 直接对 `seatTilePressable` 调 `.click()`。
- `check-e2e.sh` 列出非 resilience spec 里的 `waitForTimeout`。现在只有 `werewolf-night-wolf-girl.spec.ts:60` 一处，阶段 2 之后应该是 0。

## 10. 产品锚点：这个 PR 不做

产品锚点是产品代码在页面元素上写的只读属性，专门给测试读内部状态，不改变界面和行为。已有的例子是房间头部的 `data-phase`、`data-step`，和座位上的 `data-inert`。

这里说的锚点，是在房间头部再加一个属性，写明当前为什么不能操作：语音播放中、上一条命令待确认，或者没有锁。有了它，driver 可以直接等锁解除再点，不需要 4.2 的“点了看结果、不行再点”。

- **现在不做的原因**：这次的 flaky 是语音锁造成的，现有信号已经能读到。“上一条命令待确认”这种锁在测试里多常出现，目前没有数据。
- **什么时候做**：看 4.2 记录的重试次数。三次推送里如果它经常出现，或者有失败是它造成的，就做。
- **怎么做**：单独一个 PR。房间头部是 8 个游戏共用的，要同步改 `docs/room-shell-contract.md` 和 web 包的测试。

## 11. 不做的事

- 不加固定等待，不放大超时，不增加重试次数。
- 不重写另外 18 个 spec。
- 不改产品行为。
- 原方案不修 `e2e/tsconfig.json` 的 `@/` 别名问题；用户随后要求一并修复，追加范围见 12.4。

## 12. 实施记录

实施 worktree：`/Users/eyan/project/wgj-e2e-night-driver-hardening`，分支 `test/e2e-night-driver-hardening`，一个 [PR #400](https://github.com/olveryu/WerewolfGameJudge/pull/400)。

### 12.1 实际调整

- 第一阶段把相互依赖的 readiness、座位确认、弹窗身份和诊断一起提交，避免中间版本暴露不完整的动作语义；文档另一个提交。之后仍按阶段推送。
- 就绪除了步骤锚点和语音标记，还要求底部操作面板已渲染，避免把面板未挂载误认为没有语音锁。
- 弹窗使用捕获的 title/button DOM 节点识别同一代正文。关闭后等待旧正文卸载或替换，不让 live locator 点到下一张弹窗。
- 首批 CI 暴露了按钮在等待可用时被替换的分支。只在已确认旧正文卸载，且错误属于节点卸载/点击超时时返回扫描；其他错误仍抛出。补了回归测试，不用普通 click 重试掩盖。
- 36 处 `readAlertText` 已分类：4 处直接读取步骤提示的调用加预期标题；其余是自己动作之后的结果/状态弹窗，保留原有行为。狼女孩原有的提示正文自动等待仍保留。
- Pictionary 的请求计数轮询预算为 45 秒：30 秒重连窗口、最长 10 秒上传退避、3 秒 fetch 退避及 2 秒调度余量；不改产品重试次数。
- 可选的“禁止 spec 裸座位点击”lint 不启用：狼女孩需要有意点击受限座位来证明限制，不能机械禁止这一验证。
- 第二阶段零重试通过后，按 A/B/C/D 四批迁移全部 204 处样板断言。有场景说明的断言改为 `test.step`，说明不丢失。AST 对比确认 248 处相关 helper 调用参数不变，另 3 处业务布尔断言原样保留。最后把必需动作/等待签名改为 `Promise<void>`；扫描探测保留布尔返回值。
- `Promise<void>` 类型检查额外发现 `kill` / `special-roles` 的 5 个 `if (turn)`。保留外层角色存在性判断，删除内层成功布尔判断：角色在场时应完成该步骤，步骤缺失不能静默跳过。最终复验 E2E 类型错误仍只有原有别名问题。

### 12.2 本地验证

- 新增确定性 helper 回归测试，覆盖开局弹窗退出但语音未结束、已解锁、重复夜晚、面板未挂载、语音超时、步骤变化、无有效步骤和弹窗替换/节点卸载。不启动游戏服务器，不依赖随机角色分配。
- driver、E2E shard 覆盖和架构合同共 5997 项通过。
- root TypeScript、改动文件 ESLint/Prettier、knip、E2E policy check 通过；agent 校验 0 failures（756 个现有 warnings）。
- 阶段 1–3 的 E2E 独立 TypeScript 检查只有原有的 `RoomBottomActions.ts:3` `@/components/icons/IonIcon` 解析错误，没有新增错误；之后追加修复，见 12.4。
- 不复用共享环境中的游戏服务做本地实局；完整构建和实局 E2E 由隔离的 PR CI 验证。

### 12.3 CI 记录

| 阶段                    | Run                                                                                               | 结论    | E2E 重试                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| driver                  | [43116256746](https://github.com/olveryu/WerewolfGameJudge/actions/runs/43116256746)，`0a2a39e5a` | success | 1：石像鬼扫描弹窗按钮卸载；修复和回归在 `4f0fb58ed` |
| spec 边界及弹窗卸载修复 | [43118603786](https://github.com/olveryu/WerewolfGameJudge/actions/runs/43118603786)，`8ca43d321` | success | 0；126 个 E2E 全部首轮通过                          |

第一批 blob 的旧 20 秒 prompt fallback、旧吞错 cap、座位确认重试、扫描点击延迟计数均为 0。该次不是零 flaky 的验收样本；以上弹窗修复必须在后续 CI 重新验证。

第二批的上述计数也全部为 0，且 126 个 attempt 全部通过；其中 2 次明确覆盖主持人是守卫（`rolePage=P0`）的等待路径。`60279a5dc` 对应的 run 在补正女巫 schema 的实际提示标题后被后续推送取代，已取消，不计入验收。

### 12.4 追加：修复独立 E2E typecheck

用户要求把原有别名错误也修复。`e2e/tsconfig.json` 补齐 web 的 `@/*` 路径映射、`react-jsx` 模式和 `unplugin-icons/types/react` 声明，让经由房间模型引入的图标组件按真实类型检查，而不是用空声明或排除文件绕过错误。

root 同时声明与 web 相同版本范围的 `unplugin-icons` 开发依赖并更新 lockfile：E2E 直接使用该包的类型，不能只依赖 web 的间接安装，也不通过 knip 忽略项隐藏依赖缺失。

root `typecheck` 脚本追加 `tsc -p e2e/tsconfig.json --noEmit`，现有 CI 的 Turbo typecheck 会一并执行。独立 E2E typecheck 和 root typecheck 已无错误通过；不再接受带原有错误的基线比较。

# 解码战（decrypto）接入报告

> 由 `corepack pnpm new-game decrypto --feature identity=none --feature night=none --feature guidedNarration=none --feature stageDeadline=none --feature wordSupply=both` 生成。正式玩法、统计、复盘和词库供应已接入；已批准的 UI 和共享机器人接管已落地，用户已恢复授权 E2E、commit、push，未部署生产。

## 生成摘要

| 项                        | 值                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| 游戏 ID / 特征            | `decrypto` / identity=none、night=none、guidedNarration=none、stageDeadline=none、wordSupply=both |
| 注册表开关 / 本地首页可见 | 是 / 是（用户批准提前体验，不代表生产部署或上线验收完成）                                         |
| 布局 / 展示               | 大厅共享座位盘、局中共享舞台及名单接管；横排词卡、队伍记录板                                      |
| 已确认奖励                | 15 XP · 3 次抽取 · 每日目标 1，正常完成且至少 4 名真人时结算                                      |
| 战绩                      | 完成局数、胜场、胜率；共同获胜双方均计胜；即时可见，不回填历史                                    |

实现已覆盖 4–8 人配置、随机轮换/固定出题、强制分队弹窗、完整对局流程、复盘、
私有视图、房主机器人接管私密视图读取和后台词库供应。此前 Engine、Worker、Web 定向测试
分别通过 42、73、90 项；架构合同通过 3361 项；Root/Web/Worker 类型检查、Engine build、
lint、Prettier、knip 和新游戏验收脚本均通过。本次 UI/接管改动已完成 Web 定向测试及关联合同 113 项、
Web 类型检查，并在独立本地测试房间走通分队、双方出题、机器人代解码/拦截和两轮自动揭晓；
最终构建与静态检查证据见下方。
生产只读行数核对给出基表复制约 27,090 行（不含索引重建和删表等成本），不是迁移耗时或账单测量；本地真实 E2E 两条已通过，远端单 spec 验证待推送后执行，未部署生产。

### 由特征推导的能力

| 开关                 | 声明 |
| -------------------- | ---- |
| `nightPhase`         | 关   |
| `botsAndTakeover`    | 开   |
| `identityViewing`    | 关   |
| `revealAnimation`    | 关   |
| `stageDeadline`      | 关   |
| `audioOrchestration` | 关   |
| `wordLibrary`        | 开   |
| `gallery`            | 关   |
| `hostConfig`         | 开   |
| `botBulkViewing`     | 关   |

机器人座位与主持人接管是平台基线，不作为可选游戏特征。身份游戏自动启用身份查看与机器人身份处理；夜晚自动启用夜晚阶段与音频编排，其他引导播报启用音频编排但不虚构夜晚阶段。生成器要求对应行为用例，能力与接线由 `capabilities.contract.test.ts` 验证。

### 必需行为测试（预检）

生成前会核对下列测试文件和用例标题；删掉某项而未替换为等价覆盖时，生成会在写文件前失败。

| 测试文件                                                                        | 必需用例                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/game-engine/src/games/decrypto/__tests__/engine.test.ts`              | `resets to preparation only for the host and the intended game and phase`<br>`returns an ended game to preparation without another settlement`                                                                         |
| `packages/api-worker/src/games/decrypto/__tests__/schemas.test.ts`              | `rejects stale restart command forms and invalid restart payloads`                                                                                                                                                     |
| `packages/web/src/games/decrypto/room/__tests__/decryptoGuidanceMatrix.test.ts` | `offers fill-bots only for an open lobby and runs each setup action through its capability`<br>`marks the lobby host task as pending even when seats are missing`<br>`submits in-game restart only after confirmation` |

### 生成文件

- `docs/decrypto-game-design.md`
- `e2e/specs/decrypto.spec.ts.tmpl`
- `packages/api-worker/migrations/0091_decrypto.sql`
- `packages/api-worker/src/games/decrypto/__tests__/publicUserStats.test.ts`
- `packages/api-worker/src/games/decrypto/__tests__/schemas.test.ts`
- `packages/api-worker/src/games/decrypto/dbSchema.ts`
- `packages/api-worker/src/games/decrypto/effects.ts`
- `packages/api-worker/src/games/decrypto/module.ts`
- `packages/api-worker/src/games/decrypto/publicUserStats.ts`
- `packages/api-worker/src/games/decrypto/schemas.ts`
- `packages/game-engine/src/games/decrypto/__tests__/engine.test.ts`
- `packages/game-engine/src/games/decrypto/__tests__/publicStats.test.ts`
- `packages/game-engine/src/games/decrypto/__tests__/stateParsing.test.ts`
- `packages/game-engine/src/games/decrypto/commands/types.ts`
- `packages/game-engine/src/games/decrypto/domain/decision.ts`
- `packages/game-engine/src/games/decrypto/domain/evolve.ts`
- `packages/game-engine/src/games/decrypto/domain/rules.ts`
- `packages/game-engine/src/games/decrypto/domain/seating.ts`
- `packages/game-engine/src/games/decrypto/domain/visibility.ts`
- `packages/game-engine/src/games/decrypto/engine.ts`
- `packages/game-engine/src/games/decrypto/public.ts`
- `packages/game-engine/src/games/decrypto/publicStats.ts`
- `packages/game-engine/src/games/decrypto/state/codec.ts`
- `packages/game-engine/src/games/decrypto/state/normalize.ts`
- `packages/game-engine/src/games/decrypto/state/parseState.ts`
- `packages/game-engine/src/games/decrypto/state/types.ts`
- `packages/web/src/games/decrypto/assets/roleAvatars.ts`
- `packages/web/src/games/decrypto/components/DecryptoStatsPanel.tsx`
- `packages/web/src/games/decrypto/components/__tests__/DecryptoStatsPanel.test.tsx`
- `packages/web/src/games/decrypto/home.ts`
- `packages/web/src/games/decrypto/model/DecryptoRoomSession.ts`
- `packages/web/src/games/decrypto/module.ts`
- `packages/web/src/games/decrypto/navigation/decryptoGameNavigation.ts`
- `packages/web/src/games/decrypto/review/__tests__/decryptoReview.test.ts`
- `packages/web/src/games/decrypto/review/decryptoReview.ts`
- `packages/web/src/games/decrypto/review/toDecryptoReviewDocument.ts`
- `packages/web/src/games/decrypto/room/DecryptoRoomScreen.css`
- `packages/web/src/games/decrypto/room/DecryptoRoomScreen.tsx`
- `packages/web/src/games/decrypto/room/__tests__/DecryptoRoomScreen.test.tsx`
- `packages/web/src/games/decrypto/room/__tests__/decryptoGuidanceMatrix.test.ts`
- `packages/web/src/games/decrypto/room/__tests__/decryptoRoomCommandFailureMessage.test.ts`
- `packages/web/src/games/decrypto/room/decryptoGuidanceMatrix.ts`
- `packages/web/src/games/decrypto/room/decryptoRoomAdapter.ts`
- `packages/web/src/games/decrypto/room/decryptoRoomCommandFailureMessage.ts`
- `packages/web/src/games/decrypto/room/hooks/useDecryptoRoomState.ts`
- `packages/web/src/games/decrypto/screens/DecryptoRulesScreen.tsx`
- `packages/web/src/games/decrypto/services/decryptoStats.ts`
- `packages/web/src/test-utils/decryptoState.ts`

### 修改的共享文件

- `scripts/lib/catalogues/registry.mjs`
- `docs/catalogues/README.md`
- `packages/game-engine/src/platform/protocol/gameTypes.ts`
- `packages/game-engine/src/games/registry.ts`
- `packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts`
- `docs/README.md`
- `packages/game-engine/src/product/rewards/earnings.ts`
- `packages/game-engine/package.json`
- `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`
- `packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts`
- `packages/game-engine/src/platform/__tests__/phaseDeadlineVariants.contract.test.ts`
- `packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts`
- `packages/game-engine/src/platform/engine/__tests__/contracts.test.ts`
- `packages/game-engine/src/games/catalog.ts`
- `packages/api-worker/src/games/catalog.ts`
- `packages/web/src/games/catalog.ts`
- `packages/web/src/games/clientModules.tsx`
- `packages/web/src/__tests__/botDispatchDiscipline.contract.test.ts`
- `packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts`
- `packages/web/src/__tests__/roomReview.contract.test.ts`
- `contracts/architecture.contract.test.ts`

## 验收 disposition（按顺序）

1. **设计定稿 — 完成**：`docs/decrypto-game-design.md` 的 11 项需求已记录；功能 profile 为 identity=none、night=none、guidedNarration=none、stageDeadline=none、wordSupply=both。详细设计与后续纠正同步在该文档及 `docs/decoding-battle-game-design.md`。
2. **玩法实现 — 完成并验证**：engine、worker、web 已实现分队、回合、答案、揭晓、终局和隐私投影；Engine 定向测试 42 项通过，覆盖状态、权限、边界及拒绝行为。
3. **本局复盘 — 完成并验证**：`review/toDecryptoReviewDocument.ts`、`review/decryptoReview.ts` 和对应测试覆盖终局文档与可用性；Web scoped tests 90 项通过。
4. **奖励与战绩 — 完成并验证**：flat 奖励和统计口径见设计文档；engine 与 Worker 实现累计统计。Worker 定向测试 73 项通过，包含来源、资格、分母与原子结算覆盖。
5. **审 migration — 结构验证完成，生产成本待测**：`0091` 扩展 `rooms` 与奖励结果表的 game-type CHECK，按 0090 重建房间/词语选择依赖表并恢复索引。`0092` 扩展共享投稿 batches/items 的 game CHECK；为安全重建而暂时断开并恢复 items、actions、events 的外键，同时重建 batches。内存 SQLite 迁移验证确认既有投稿、审核动作、审计事件、计数、事件自增序列、外键均保留，且 Decrypto 投稿与计数触发器正常。生产只读行数核对已估算基表复制约 27,090 行；索引、删表、实际耗时与计费仍未测量，未执行生产迁移。
6. **E2E 启用 — 本地两条通过，远端待验**：`e2e/specs/decrypto.spec.ts` 使用六个独立真人上下文验收固定出题八轮、猜词加赛、房主判定、复盘及回准备；另用四个独立上下文验证轮换和密码权限。已登记一个 CI 分片，不用机器人替代玩家。分队验证全员唯一归属，角色席位不合法即携带轮次、队伍和席位信息失败；非房主先确认进入裁定阶段再检查权限，重开验证全部六席及每位玩家原座位保留。
7. **词库（both）— 完成并验证**：局内准备、后台 workflow、审核投稿、admin 分类/统计/触发和发布 adapter 已实现；registry、Worker export、Wrangler workflow/binding 均已登记，Worker Env 类型已生成。Worker 定向测试、类型检查及架构合同均通过。
8. **验证 — 本地定向验收及真实 E2E 完成**：本次交付 Web 定向测试及关联合同 126 项、Worker 124 项、Engine 396 项、Root 4 个测试文件 3423 项及 E2E 两条通过。此前 Web UI 113 项覆盖顶部出题人下拉、长名展开、人数下限反馈、密码视角、逐项公开、私密视图刷新期间的公开揭晓和八轮仅显示一张记录表。独立本地房间手工检查了两轮流程：首轮跳过拦截，次轮逐项间隔约 1.4 秒、数字按 0/120/240ms 入场；减少动态效果偏好下无动画且数字保持可见。密码卡在 430px 视口下高 74px、标题 20px 粗体、数字格 44×56px，无横向溢出；人数达到下限时图标 44×44px，点击显示原因且没有命令请求。全量验收由 CI 执行，已执行的每项本地命令均以退出码判定。
9. **入口提前开放，生产未部署**：用户批准 `GAME_REGISTRY.decrypto.isProduction = true` 供本地体验，已确认小游戏可见；不代表所有验收完成。已授权验证后 commit、push，不执行生产迁移或部署。

### 后台维护词库

- 在统一词库工作台选择「解码战」，按「常用词」分类触发补词；复用现有补词次数、确认、错误反馈与审核列表。
- 生成结果以「系统补词」身份进入待审核投稿；外部投稿也走同一审核、人工批准、确认发布和下架流程，不会直接进入活跃词库。
- 只有发布为 `active` 的词会用于新局抽取；每局八个词固定存档，之后下架不改变已开局的词卡。
- 集成测试覆盖管理员身份边界、单独批准与发布、发布词进入真实抽词结果、下架阻止新抽取，以及已有对局词卡保持不变。

### 本次 UI 最终检查

- `corepack pnpm --filter @game-judge/web run test src/games/decrypto src/__tests__/noHardcodedStyleValues.contract.test.ts src/__tests__/botDispatchDiscipline.contract.test.ts src/__tests__/roomReview.contract.test.ts`：9 个测试文件、113 项通过。
- `corepack pnpm --filter @game-judge/web run typecheck`、`corepack pnpm exec tsc --noEmit`：通过。
- `corepack pnpm --filter @game-judge/web run build`：通过，包含路由 gzip 预算。
- `corepack pnpm exec eslint packages/web/src/games/decrypto/room`：通过。
- `corepack pnpm exec prettier --check packages/web/src/games/decrypto/room docs/decrypto-game-design.md docs/decoding-battle-game-design.md new-game-decrypto-report.md`：通过。
- `corepack pnpm run knip`：通过。

### 本次交付验证

- `E2E_BASE_URL=http://localhost:5175 corepack pnpm exec playwright test e2e/specs/decrypto.spec.ts --project=chromium --reporter=list,./e2e/reporters/failureBundle.ts`：两条通过，约两分钟；复用本任务的本地 Web/Worker，不改写其他本地服务或用户正在体验的房间。
- `corepack pnpm --filter @game-judge/api-worker run test src/games/decrypto src/features/admin/__tests__/gameWords.test.ts src/features/wordSubmissions/__tests__/supplyIngestion.test.ts src/features/wordSubmissions/__tests__/submissions.test.ts src/games/__tests__/catalog.test.ts`：9 个文件、124 项通过，覆盖后台补词、人工发布、下架与实际抽词的衔接。
- `corepack pnpm --filter @game-judge/game-engine run test src/games/decrypto src/platform/__tests__/architecture.contract.test.ts src/platform/__tests__/engineSkeleton.contract.test.ts src/platform/__tests__/phaseDeadlineVariants.contract.test.ts src/platform/engine/__tests__/capabilities.contract.test.ts src/platform/engine/__tests__/contracts.test.ts`：8 个文件、396 项通过。
- `corepack pnpm run test contracts/architecture.contract.test.ts contracts/ciE2eCoverage.contract.test.ts contracts/localDevSetup.test.ts scripts/new-game.test.mjs`：4 个文件、3423 项通过；生成器测试的子运行结果不重复累计。
- Web 游戏目录、样式/接管/复盘/引导矩阵/首页入口合同：11 个文件、126 项通过。
- Root/Web/Worker/E2E 类型检查、Engine/Web 构建（含路由 gzip 预算）、全部变更代码 lint、knip 和 E2E 规范脚本通过。
- 最初揭晓阶段的默认五秒断言等待不足，已改为二十秒内等待真实阶段变化，而非固定 sleep；房主复盘使用共享房主动作 ID，不改变产品逻辑迁就测试。失败证据由共享 diagnostics、截图、trace 和 failure bundle 保留。
- 推送后须触发 `e2e-single-spec.yml`，核对远端运行的分支、SHA 与 `conclusion`；本地通过不替代该验收，不执行生产迁移或部署。

只有九步都有实现与验证证据（或批准的不适用理由），才能将游戏视为可上线。详细验收见 [new-game skill](.agents/skills/new-game/SKILL.md) 与 [能力和报告说明](.agents/skills/new-game/references/capabilities-and-report.md)。

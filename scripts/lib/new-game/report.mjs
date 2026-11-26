import {
  formatFeatureDeclarations,
  formatFeatureSummary,
  resolveFeatureTestRequirements,
} from './features.mjs';

/**
 * 接入报告 (integration report) builder: after a generation run the
 * operator gets one markdown file at the repository root listing what
 * the generator wrote, which shared files it edited, and the manual
 * steps that remain before the new game is a real game.
 */

export const REPORT_STEP_COUNT = 9;

export function buildIntegrationReport({
  gameId,
  names,
  home,
  rewards,
  capabilities,
  features,
  createdFiles,
  editedFiles,
  migrationName,
  production,
}) {
  const capabilityRows = Object.entries(capabilities)
    .map(([key, value]) => `| \`${key}\` | ${value ? '开' : '关'} |`)
    .join('\n');
  const created = createdFiles.map((file) => `- \`${file}\``).join('\n');
  const edited = editedFiles.map((file) => `- \`${file}\``).join('\n');
  const featureArgs = formatFeatureDeclarations(features);
  const identityNote =
    features.identity !== 'private'
      ? ''
      : features.bots === 'enabled'
        ? ' 将 `TODO_IDENTITY` 替换为已批准的身份表；身份能力会自动包含机器人身份查看，验证主持人处理机器人身份及玩家/旁观者隐私。'
        : ' 将 `TODO_IDENTITY` 替换为已批准的身份表；本游戏没有机器人，每个座位由真人自行查看，验证玩家/旁观者隐私。';
  const rewardsRow =
    rewards === null
      ? '无（`rewards=none`：终局不产生 completion 结算、不发奖励）'
      : `${rewards.xpEarned} XP · ${rewards.normalDrawsEarned} 次抽取 · 每日目标 ${rewards.dailyCompletionTarget}`;
  const statsRow =
    features.stats === 'enabled'
      ? '通过人数门槛的终局 completion 计 1 局；不推断胜负/分数或历史数据'
      : '无（`stats=none`：不建统计表、不提供战绩面板）';
  const botsNote =
    features.bots === 'enabled'
      ? '已声明 `bots=enabled`：机器人座位与主持人接管已接通；身份游戏自动启用身份查看与机器人身份处理。'
      : '本游戏声明 `bots=none`：命令词表不含 `room.seat.fillBots`，Worker 拒绝补机器人，客户端无接管入口；身份游戏只启用真人身份查看。';
  const rewardsAndStatsStep =
    rewards === null
      ? '4. **奖励与战绩：不适用**：特征声明为 `rewards=none`、`stats=none`，终局不产生 completion 结算；在设计文档记录批准理由。设计变更需要奖励或战绩时，先更新特征声明再重新生成对应接线。'
      : features.stats === 'enabled'
        ? '4. **奖励与战绩口径确认**：明确批准 flat / levelRoll 和奖励数值；统计确定局/轮单位、事实归属、分母/零分母、时间精度、历史缺口、迁移和可见性/缓存策略。completed-games 只是基线；不需要额外指标也必须记录批准理由。每个批准指标都要在 engine `__tests__/publicStats.test.ts` 和 Worker `__tests__/publicUserStats.test.ts` 覆盖来源、单位、边界/零分母及所有权；只验证同步清单或 DTO 形状不算语义验收。保持冻结真人名单、作者过滤顺序及严格 legacy/v2 兼容；详见 [统计接线](.agents/skills/new-game/references/skeleton-and-wiring.md#statistics-and-settlement)。'
        : '4. **奖励口径确认**：明确批准 flat / levelRoll 和奖励数值。特征声明为 `stats=none`：不建统计表、不提供战绩面板，在设计文档记录批准理由；需要战绩时先更新特征声明再重新生成。';
  const audioNote = capabilities.audioOrchestration
    ? ' 补齐 registry/player、每个夜晚/引导阶段的提示映射和打包音频；验证阶段顺序、行动者、播报门禁、重播、音乐及失败恢复。'
    : ' 本特征声明没有夜晚或其他引导播报；若设计变更，先更新特征声明再生成对应音频接线。';
  const catalogueNote = capabilities.nightPhase
    ? ` 共享步骤、客户端交互和清单登记已接通，但 TODO 示例不是批准玩法。补齐 \`nightScenarios.ts\` 的正式命令场景及步骤/文案覆盖，缺场景或未完成文案必须失败；按 [清单审批流程](docs/catalogues/README.md) 报告差异，确认后显式运行 \`catalogue:update --reviewed ${gameId}-night\`。不自动创建基准、不用 \`-u\` 批准。`
    : '';
  const wordSupplyMode = features.wordSupply;
  const requiredTestRows = resolveFeatureTestRequirements(features, {
    gameId,
    gameName: names.camel,
  })
    .map(
      ({ file, testCases }) =>
        `| \`${file}\` | ${testCases.map((testCase) => `\`${testCase}\``).join('<br>')} |`,
    )
    .join('\n');
  const wordSupplyStep =
    wordSupplyMode === 'none'
      ? '7. **词库：不适用**：特征声明为 `wordSupply=none`；设计变更需要词库时，先更新特征声明并补齐三处 workflow 接线。'
      : `7. **词库（${wordSupplyMode}）**：按已声明的供应模式实现 workflow，并为实际准备/后台供应流程补行为测试；同时登记 \`packages/game-engine/src/games/registry.ts\` 的 \`workerWorkflows\`（\`workflowName: '${gameId}-word-supply'\`、\`binding: '${gameId.toUpperCase()}_WORD_SUPPLY'\`、\`exportName: '${names.pascal}WordSupplyWorkflow'\`）、\`packages/api-worker/src/index.ts\`（\`export { ${names.pascal}WordSupplyWorkflow } from './games/${gameId}/wordSupplyWorkflow';\`）、\`packages/api-worker/wrangler.toml\` 的 \`[[workflows]]\` block（\`binding = "${gameId.toUpperCase()}_WORD_SUPPLY"\`），并运行 Wrangler 更新 \`worker-configuration.d.ts\`。架构合同核对 registry、部署配置与 Env 类型。词库登记与上述接线同一次落地：用 \`defineWordCategoryCatalog('${gameId}', [...])\` 定义已批准的分类目录、把 \`${gameId}\` 加进 \`GAME_WORD_GAMES\` 并补齐各个按词库游戏穷举的适配表，条目与生成时传入的 \`--word-category\` 逐项相同、顺序相同（注册迁移 \`${migrationName}\` 已按它插好 \`word_games\` 与 \`word_categories\`）；还要把它加进 \`contracts/d1Catalog.contract.test.ts\` 的 \`CATEGORY_CATALOGS\`，该合同钉查表与代码逐行相等。`;
  return `# ${home.displayName}（${gameId}）接入报告

> 由 \`corepack pnpm new-game ${gameId}${featureArgs}${production ? ' --production' : ''}\` 生成。骨架只接通底盘，尚不是可玩的游戏；所有 \`TODO(gameplay)\` 都必须完成。

## 生成摘要

| 项 | 值 |
| --- | --- |
| 游戏 ID / 特征 | \`${gameId}\` / ${formatFeatureSummary(features)} |
| 生产态 / 首页可见 | ${production ? '是 / 是' : '否 / 否（注册但隐藏）'} |
| 布局 / 展示 | ${capabilities.identityViewing ? '全阶段共享座位盘' : '大厅座位盘、开局后工作区'}；${home.displayName} / ${home.subtitle} |
| 奖励占位值 | ${rewardsRow} |
| 战绩基线 | ${statsRow} |

### 由特征推导的能力

| 开关 | 声明 |
| --- | --- |
${capabilityRows}

${botsNote}夜晚自动启用夜晚阶段与音频编排，其他引导播报启用音频编排但不虚构夜晚阶段。生成器要求对应行为用例，能力与接线由 \`capabilities.contract.test.ts\` 验证。

### 必需行为测试（预检）

生成前会核对下列测试文件和用例标题；删掉某项而未替换为等价覆盖时，生成会在写文件前失败。

| 测试文件 | 必需用例 |
| --- | --- |
${requiredTestRows}

### 生成文件

${created}

### 修改的共享文件

${edited}

## 还差的人工步骤（按顺序）

1. **设计定稿**：完成 \`docs/${gameId}-game-design.md\` 的 11 项需求表并取得批准。占位人数、展示名、副标题和图标不是最终设计。限制开局、参与、身份分配或目录可见性时，注明规则来源、合同依据或用户确认；奖励/战绩门槛不是玩法门槛。特征声明为：${formatFeatureSummary(features)}。${identityNote}
2. **玩法实现**：在 engine、worker、web 的 \`${gameId}\` 目录处理所有 \`TODO(gameplay)\`。在 engine \`__tests__/engine.test.ts\` 为每个批准的状态转移、边界和拒绝路径补行为断言；示例命令的 \`notImplemented\` 测试必须保留到玩法真正实现，不能以骨架通过冒充完成。按 [骨架与接线清单](.agents/skills/new-game/references/skeleton-and-wiring.md) 复用房间组件，验证阶段操作、隐私投影、房主控件、素材预加载、身份/机器人变体与终局界面。${audioNote}${catalogueNote}
3. **本局复盘填空**：实现 \`packages/web/src/games/${gameId}/review/to${names.pascal}ReviewDocument.ts\` 和 \`review/${names.camel}Review.ts\`，补齐 \`review/__tests__/${names.camel}Review.test.ts\`。只用 \`packages/web/src/features/room/review/types.ts\` 的封闭 block vocabulary；需要新表达时先扩展平台。按批准玩法断言终局事实、参与者/身份/成绩归属、轮次标识、阶段可用性和观战者内容，不要只保留生成器的通用名单示例。局面 fixture \`${names.upper}_REVIEW_ROUNDS\` 已注册，玩法变化时同步维护。
${rewardsAndStatsStep}
5. **审 migration**：生成器先在 node:sqlite 里按顺序重放现有全部迁移、按得到的实际 schema 做前置检查，再生成并试跑；它的产物只是起点，不是模板。提交前对照当前 schema 与本游戏需求手工审 \`packages/api-worker/migrations/${migrationName}\`：只插 \`game_types\` 一行（\`sort_order\` 追加在末尾，与 \`GAME_TYPES\` 一致）、词库游戏另插 \`word_games\`/\`word_categories\`，不重建任何表；改了这份迁移就同步改 \`contracts/d1MigrationManifest.json\` 里它的 sha256；新增累计表的约束与外键按 [注册清单](.agents/skills/new-game/references/registration-checklist.md) 审。迁移规则见 \`packages/api-worker/AGENTS.md\`。
6. **e2e 启用需用户批准**：\`e2e/specs/${gameId}.spec.ts.tmpl\` 默认不进 CI。批准后按 \`new-e2e-spec\` skill 改为真实多 context 测试，并将 spec 加入 \`.github/workflows/ci.yml\` 分片矩阵。
${wordSupplyStep}
8. **验证**：运行 skill acceptance commands、generator contract、受影响包测试/typecheck、lint/format 和 \`knip\`。覆盖玩法完成、授权/隐私、确认与音频回执顺序、统计原子性/重试及 profile/settings 的加载、错误、空态、真实数量；注册迁移要在完整迁移链上跑 \`contracts/d1Catalog.contract.test.ts\`（查表与代码逐行相等）并检查外键。完整 quality/E2E 由 CI 执行。每一步记录验证证据，或用户批准的不适用理由。
9. **上线${production ? '（已同步目录名单）' : '（翻生产）'}**：${
    production
      ? '`--production` 已将 registry `isProduction` 设为 true，并更新 `homeProductionFilter.contract.test.ts` 中的 `PRODUCTION_GAME_TYPES`；这不等于部署或玩法验收。先完成其他步骤。'
      : `默认已注册但首页隐藏。获批且验证完成后，将 registry \`isProduction\` 设为 true，并在 \`homeProductionFilter.contract.test.ts\` 的 \`PRODUCTION_GAME_TYPES\` 中加入 \`${gameId}\`；合同要求两处同步。两处齐不是上线充分条件。`
  }

只有九步都有实现与验证证据（或批准的不适用理由），才能将游戏视为可上线。详细验收见 [new-game skill](.agents/skills/new-game/SKILL.md) 与 [能力和报告说明](.agents/skills/new-game/references/capabilities-and-report.md)。
`;
}

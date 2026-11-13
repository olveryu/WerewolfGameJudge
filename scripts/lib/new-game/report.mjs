/**
 * 接入报告 (integration report) builder: after a generation run the
 * operator gets one markdown file at the repository root listing what
 * the generator wrote, which shared files it edited, and the manual
 * steps that remain before the new game is a real game.
 */

const PRESET_LABELS = {
  identity: '身份推理型（identity）',
  stage: '舞台回合型（stage）',
  'demo-hybrid': '身份查看＋舞台截止混合型（demo-hybrid）',
};

export const REPORT_STEP_COUNT = 9;

export function buildIntegrationReport({
  gameId,
  preset,
  names,
  home,
  rewards,
  capabilities,
  createdFiles,
  editedFiles,
  migrationName,
  production,
  businessStats = true,
}) {
  const capabilityRows = Object.entries(capabilities)
    .map(([key, value]) => `| \`${key}\` | ${value ? '开' : '关'} |`)
    .join('\n');
  const created = createdFiles.map((file) => `- \`${file}\``).join('\n');
  const edited = editedFiles.map((file) => `- \`${file}\``).join('\n');
  return `# ${home.displayName}（${gameId}）接入报告

> 由 \`pnpm new-game ${gameId} --preset ${preset}\` 生成。骨架已经接通底盘与注册，
> 但**还不是一个能玩的游戏**：所有 \`// TODO(gameplay):\` 标记处都是待填的玩法，
> 未填的玩法命令会显式抛「未实现」，不会假绿。

## 生成参数

| 项 | 值 |
| --- | --- |
| 游戏 ID | \`${gameId}\` |
| 原型预设 | ${PRESET_LABELS[preset]} |
| 生产态 | ${production ? '是（--production）' : '否（默认非生产，上线动作见第 9 步）'} |
| 展示名 / 副标题 | ${home.displayName} / ${home.subtitle} |
| 首页图标 / 档位 | ${home.iconName} / ${home.tier} |
| 完成奖励（flat） | xpEarned ${rewards.xpEarned} · normalDrawsEarned ${rewards.normalDrawsEarned} · dailyCompletionTarget ${rewards.dailyCompletionTarget} |
| 类名派生 | ${names.pascal} / ${names.camel} / ${names.upper} |
${
  businessStats
    ? `| 战绩基线 | 每次符合人数门槛的终局完成计 1 局；无胜负、分数或历史回填推断 |
`
    : ''
}

## 能力开关声明（引擎 engine.ts，已与 contract 期望表对齐）

| 开关 | 声明 |
| --- | --- |
${capabilityRows}

开关只表示「接没接这块底盘能力」。生成后按玩法改声明时，必须同步改
\`capabilities.contract.test.ts\` 的期望行——contract 会逐项验声明与接线是否一致。

## 生成的文件

${created}

## 生成器改动的共享文件

${edited}

## 还差的人工步骤（按顺序）

1. **设计定稿**：把 \`docs/${gameId}-game-design.md\` 里的 ${businessStats ? 11 : 10} 项需求表填完并走批准流程
   （new-game skill Phase 1）；骨架里的默认人数、展示名、副标题、图标都是占位值。${
     capabilities.identityViewing
       ? `\n   身份型预设另需把 \`TODO_IDENTITY\` 占位身份换成真实身份表，并按仓库立绘流程生产
   角色立绘与图鉴素材（prompt 先审、生成过目后才入库）。`
       : ''
   }
2. **玩法填空**：全仓 grep \`TODO(gameplay)\`（限定 \`packages/game-engine/src/games/${gameId}\`、
   \`packages/api-worker/src/games/${gameId}\`、\`packages/web/src/games/${gameId}\`），逐个填掉：
   身份/回合的玩法状态机在 \`domain/decision.ts\` 与 \`engine.ts\` 的 TODO 接缝处接入，
   视图投影在 \`domain/visibility.ts\` 补齐隐私裁剪。
3. **本局复盘填空**：复盘已全链接通——模块 \`review\`、终局底部「本局复盘」按钮
   （所有观看者）、房主面板复盘动作与终局任务（本局复盘 / 再来一局 / 返回大厅），
   弹窗与图片分享归平台。骨架文档只有 hero「本局结束」+ 参与者名单：按设计文档把
   本局事实（胜负、身份、得分、过程）填进
   \`packages/web/src/games/${gameId}/review/to${names.pascal}ReviewDocument.ts\`，可用条件与分享权限在
   \`packages/web/src/games/${gameId}/review/${names.camel}Review.ts\` 定，并同步改两者的测试
   \`review/__tests__/${names.camel}Review.test.ts\`。块词汇是封闭集合
   （\`packages/web/src/features/room/review/types.ts\`）：表达不了的内容先扩平台词汇，不许游戏自写复盘 JSX。
   生成器已把真实引擎打出的大厅 / 终局 / 下一局（\`packages/web/src/test-utils/${gameId}State.ts\` 的
   \`${names.upper}_REVIEW_ROUNDS\`）登记进 \`packages/web/src/__tests__/roomReview.contract.test.ts\`：
   终局玩法或局号来源改了，同步改这组局面。
4. **奖励与战绩口径确认**：参数表里的三数是占位值（见上表），明确选择并批准
   flat / levelRoll 奖励政策和数值；骨架保留 flat，不擅自替换奖励策略。
   flat 数值在 \`packages/game-engine/src/product/rewards/earnings.ts\`，
   \`packages/game-engine/src/games/registry.ts\` 引用同一份常量。${
     businessStats
       ? `
   已生成的战绩只是 completed-games 基线，不代表玩法统计已完成。必须逐项批准：
   结算单位（局/轮）、指标来源与归属、单位/分母/零分母、时间精度、历史采集缺口、
   状态/完成 payload/D1 迁移政策、即时/延迟可见与缓存策略。轮结算游戏同步修改 UI 单位。
   然后在本游戏的 publicStats、终局事实、dbSchema/migration、publicUserStats 和 StatsPanel
   实现已批准的玩法指标并验证；不需要额外指标也必须记录批准理由，不能默认“已完成”。
   人数门槛按过滤前冻结真人名单（游客计人数，机器人不计），奖励与战绩只给注册账号；
   创作游戏的作者过滤在人数判定之后执行。以演化后的终局状态取事实，v2 stats 用户必须
   与奖励名单一一对应且保持座位顺序；旧严格 payload 仅发原奖励，不伪造缺失战绩。`
       : ''
   }
5. **审 migration**：\`packages/api-worker/migrations/${migrationName}\` 是从上一份注册
   migration 机械派生的骨架——应用前人工核对重建表集合与现行 schema 一致；
   ${
     businessStats
       ? `已带游戏自有累计表 \`${gameId}_user_stats\`，没有逐局流水或新索引。
   对比约束、外键、触发器与索引，估算表复制的一次性读写成本；玩法字段按批准的迁移政策追加。`
       : '游戏自有表按文件末尾的 TODO 补进同一份 migration。'
   }
6. **e2e 启用需用户批准**：\`e2e/specs/${gameId}.spec.ts.tmpl\` 是多真人多 context 的
   spec 骨架，默认不进 CI。启用时改名为 \`${gameId}.spec.ts\` 并把文件名加进
   \`.github/workflows/ci.yml\` 的 e2e 分片矩阵（ciE2eCoverage contract 会验全量一致）。
7. **词库（如需要）**：把引擎 \`wordLibrary\` 开关打开时，供词 workflow 要在
   三处登记，缺一处都不完整（骨架不带 workflow 本体，类本体按 new-game skill
   的供词步骤手写在 \`packages/api-worker/src/games/${gameId}/wordSupplyWorkflow.ts\`）：
   ① 注册表 \`packages/game-engine/src/games/registry.ts\` 本条目的
   \`workerWorkflows\` 加一项 \`{ exportName: '${names.pascal}WordSupplyWorkflow', modulePath: './games/${gameId}/wordSupplyWorkflow' }\`
   ——capabilities contract 验引擎声明与登记一致，漏这处会红；
   ② \`packages/api-worker/src/index.ts\` 的 workflow 导出区加一行
   \`export { ${names.pascal}WordSupplyWorkflow } from './games/${gameId}/wordSupplyWorkflow';\`
   ——architecture contract 验注册表与导出双向一致，漏这处会红；
   ③ \`packages/api-worker/wrangler.toml\` 加一段 \`[[workflows]]\`
   （\`name = "${gameId}-word-supply"\`、\`binding = "${gameId.toUpperCase()}_WORD_SUPPLY"\`、\`class_name = "${names.pascal}WordSupplyWorkflow"\`）
   ——必须核对 binding 与 Env 的运行时类型。三处齐后，按 skill 的供词步骤建词表、
   灌种子词并验证 workflow，不能空表上线。
8. **门禁复跑**：引擎 / worker / web 的本游戏路径测试及受影响 contract、
   \`pnpm exec tsc --noEmit\`、改动包 typecheck、\`pnpm run knip\`、改动文件 prettier/eslint，
   加 skill 的只读 check；完整 quality 和全量 E2E 留给 CI，不拿本地全套当门禁。
   ${
     businessStats
       ? `战绩证据须覆盖终局/重复/重开/中止/人数门槛、匿名/机器人/作者归属、
   严格 v2 与 legacy、D1 原子失败回滚/重放/删除级联/读写预算、HTTP DTO、设置与资料卡、
   pending/error 必须显示未知统计，不改变既有物品解锁及装备权限，奖励 inbox 触发既有缓存失效。`
       : ''
   }${
     production
       ? `
9. **上线（同步绊线名单）**：本次以 \`--production\` 生成，注册表已是
   \`isProduction: true\`，还须把 \`'${gameId}'\` 按它在 \`GAME_TYPES\`
   中的顺序位置，加进 \`packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts\`
   的 \`PRODUCTION_GAME_TYPES\` 名单——这份硬编码名单是刻意保留的绊线，
   生产集合变更永远是显式动作。所有人工步骤须记录“已实现并验证”或获批准的不适用理由；
   设计/奖励/战绩口径未批准、指标未实现或验证缺失时不能上线。名单同步不是上线充分条件。`
       : `
9. **上线（翻生产）**：本次生成默认非生产（注册表 \`isProduction: false\`）——
   游戏已全注册、凭房间码可进，但首页模式列表（建房入口）不可见。
   玩法完成、门禁全绿后，在同一个 PR 里做两处显式动作才算上线：
   ① \`packages/game-engine/src/games/registry.ts\` 本游戏条目改 \`isProduction: true\`；
   ② 把 \`'${gameId}'\` 按它在 \`GAME_TYPES\` 中的顺序位置，加进
   \`packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts\` 的
   \`PRODUCTION_GAME_TYPES\` 名单（硬编码名单是刻意保留的绊线）。
   两处只改其一会被 contract 拦住；所有人工步骤须记录“已实现并验证”或获批准的不适用理由；
   设计/奖励/战绩口径未批准、指标未实现或验证缺失时不能上线。两处齐不是上线充分条件。`
   }
`;
}
